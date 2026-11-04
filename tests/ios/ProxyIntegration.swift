// Run on macOS 14+ against the local authenticated HTTP/SOCKS fixture:
// swiftc modules/nou-tube-view/ios/NouProxy.swift tests/ios/ProxyIntegration.swift -o /tmp/ProxyIntegration
#if os(macOS)
import AppKit
#else
import UIKit
#endif
import Foundation
import WebKit

private struct TestFailure: Error { let message: String }
private func trace(_ message: String) {
  print(message)
  #if os(iOS)
  let file = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("trace.txt")
  let previous = (try? String(contentsOf: file, encoding: .utf8)) ?? ""
  try? (previous + message + "\n").write(to: file, atomically: true, encoding: .utf8)
  #endif
}

private func expect(_ condition: Bool, _ message: String) throws {
  if !condition { throw TestFailure(message: message) }
}

@MainActor
private final class PageProbe: NSObject, WKNavigationDelegate {
  let webView = WKWebView(frame: .zero)
  private var pending: CheckedContinuation<String, Error>?
  private var requestID = UUID()

  override init() {
    super.init()
    webView.navigationDelegate = self
  }

  func load(_ url: URL) async throws -> String {
    try await withCheckedThrowingContinuation { continuation in
      pending = continuation
      let requestID = UUID()
      self.requestID = requestID
      var requestURL = URLComponents(url: url, resolvingAgainstBaseURL: false)!
      requestURL.queryItems = [URLQueryItem(name: "nonce", value: UUID().uuidString)]
      webView.load(URLRequest(url: requestURL.url!, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 8))
      DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
        guard let self, self.pending != nil, self.requestID == requestID else { return }
        self.finish(.failure(TestFailure(message: "WebView request timed out")))
        self.webView.stopLoading()
      }
    }
  }

  private func finish(_ result: Result<String, Error>) {
    let continuation = pending
    pending = nil
    continuation?.resume(with: result)
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    webView.evaluateJavaScript("document.body.innerText") { [weak self] value, error in
      if let error { self?.finish(.failure(error)) }
      else { self?.finish(.success(value as? String ?? "")) }
    }
  }
  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
    finish(.failure(error))
  }
  func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
    finish(.failure(error))
  }
}

#if os(macOS)
@main
#endif
private struct ProxyIntegration {
  @MainActor static func main() async {
    #if os(macOS)
    _ = NSApplication.shared
    #endif
    do {
      try await run()
      print("PASS: iOS-shared proxy configuration, URLSession and WebKit")
      exit(0)
    } catch {
      print("FAIL: \(error)")
      exit(1)
    }
  }

  @MainActor private static func apply(_ settings: NouProxySettings) {
    NouProxy.shared.update(settings)
    NouProxy.shared.applyToWebViews()
  }

  private static func fetch(_ url: URL) async throws -> String {
    let session = URLSession(configuration: try NouProxy.shared.sessionConfiguration())
    defer { session.invalidateAndCancel() }
    let (data, response) = try await session.data(from: url)
    try expect((response as? HTTPURLResponse)?.statusCode == 200, "Expected a successful proxied response")
    return String(decoding: data, as: UTF8.self)
  }

  private static func rejectionCount(_ type: String) async throws -> Int {
    let (data, _) = try await URLSession.shared.data(from: URL(string: "http://127.0.0.1:19844/stats")!)
    let counts = try JSONDecoder().decode([String: Int].self, from: data)
    guard let count = counts[type] else { throw TestFailure(message: "Missing fixture rejection count") }
    return count
  }

  @MainActor fileprivate static func run() async throws {
    guard #available(iOS 17.0, macOS 14.0, *) else { throw TestFailure(message: "macOS 14+ required") }
    for port in ["", "0", "65536", "bad"] {
      let invalid = NouProxySettings(enabled: true, host: "127.0.0.1", port: port)
      do { try invalid.validate(); throw TestFailure(message: "Invalid proxy accepted") }
      catch is NouProxyError {}
    }
    let url = URL(string: "http://proxy-verification.invalid/check")!
    let page = PageProbe()
    for type in ["http", "socks"] {
      var settings = NouProxySettings(
        enabled: true, type: type, host: "127.0.0.1", port: type == "http" ? "19841" : "19842",
        username: "nou-test", password: "p@ss:/ test"
      )
      apply(settings)
      trace("\(type): starting URLSession success check")
      try expect(try await fetch(url) == "proxy works", "URLSession did not use authenticated \(type)")
      trace("\(type): starting WebKit success check")
      try expect(try await page.load(url).trimmingCharacters(in: .whitespacesAndNewlines) == "proxy works", "WebKit did not use authenticated \(type)")
      trace("\(type): URLSession and WebKit authenticated")
      settings.password = "wrong"
      apply(settings)
      // WebKit applies proxy changes asynchronously in its network process.
      try await Task.sleep(for: .seconds(1))
      // A new origin forces a fresh tunnel. Changing proxy credentials does
      // not revoke a connection that the proxy already authenticated.
      let rejectedURL = URL(string: "http://\(UUID().uuidString.lowercased()).proxy-verification.invalid/check")!
      trace("\(type): starting URLSession rejection check")
      let beforeSession = try await rejectionCount(type)
      do { _ = try await fetch(rejectedURL); throw TestFailure(message: "URLSession accepted bad credentials") }
      catch is TestFailure { throw TestFailure(message: "URLSession accepted bad credentials") }
      catch {}
      try expect(try await rejectionCount(type) > beforeSession, "Fixture did not reject URLSession credentials")
      trace("\(type): starting WebKit rejection check")
      let beforeWebKit = try await rejectionCount(type)
      do { _ = try await page.load(rejectedURL); throw TestFailure(message: "WebKit accepted bad credentials") }
      catch let failure as TestFailure { throw failure }
      catch {}
      try expect(try await rejectionCount(type) > beforeWebKit, "Fixture did not reject WebKit credentials")
      trace("\(type): both rejected wrong credentials")
    }
    apply(NouProxySettings(enabled: true, host: "", port: "19841"))
    do { _ = try NouProxy.shared.sessionConfiguration(); throw TestFailure(message: "Invalid endpoint did not block feeds") }
    catch is NouProxyError {}
    try expect(!WKWebsiteDataStore.default().proxyConfigurations.isEmpty, "Invalid enabled endpoint fell back to direct")
    apply(NouProxySettings())
    try expect(WKWebsiteDataStore.default().proxyConfigurations.isEmpty, "Disabling did not clear WebKit proxy")
    try expect(try NouProxy.shared.sessionConfiguration().proxyConfigurations.isEmpty, "Disabling did not clear feed proxy")
  }
}

#if os(iOS)
@main
private final class ProxyTestApp: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    let controller = UIViewController()
    let label = UILabel()
    label.numberOfLines = 0
    label.text = "Running proxy integration tests…"
    controller.view = label
    window = UIWindow(frame: UIScreen.main.bounds)
    window?.rootViewController = controller
    window?.makeKeyAndVisible()
    Task { @MainActor in
      let result: String
      do {
        try await ProxyIntegration.run()
        result = "PASS: URLSession and WKWebView HTTP/SOCKS authentication, rejection, invalid endpoints and disabling"
      } catch { result = "FAIL: \(error)" }
      label.text = result
      let file = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("result.txt")
      try? result.write(to: file, atomically: true, encoding: .utf8)
    }
    return true
  }
}
#endif
