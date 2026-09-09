import ExpoModulesCore
import WebKit
import AVFoundation

// Hosts YouTube itself; anything else is handed to the system browser, matching
// the Android view's shouldOverrideUrlLoading.
private let viewHostSuffixes = ["youtube.com", "youtu.be"]

private func isInAppHost(_ host: String?) -> Bool {
  guard let host = host?.lowercased() else { return false }
  if viewHostSuffixes.contains(where: { host == $0 || host.hasSuffix(".\($0)") }) {
    return true
  }
  return host.hasPrefix("accounts.google.") || host.hasPrefix("gds.google.")
}

// Tracking rather than advertising, so this stays blocked either way.
private let blockHosts = ["www.googletagmanager.com"]

// WKUserContentController retains its message handlers strongly, so the view
// registers through this instead and can still be deallocated.
private final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
  weak var target: WKScriptMessageHandler?

  init(_ target: WKScriptMessageHandler) {
    self.target = target
  }

  func userContentController(
    _ userContentController: WKUserContentController,
    didReceive message: WKScriptMessage
  ) {
    target?.userContentController(userContentController, didReceive: message)
  }
}

public final class NouTubeView: ExpoView, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler,
  UIScrollViewDelegate {
  let onLoad = EventDispatcher()
  let onMessage = EventDispatcher()

  internal private(set) var webView: WKWebView!

  // WKWebView hands the bridge to every frame, ad iframes included. Only the
  // main frame is ever given this token (the bridge script is
  // forMainFrameOnly), so cross-origin frames cannot drive the device-level
  // setters behind it.
  private let bridgeToken = UUID().uuidString

  private var scriptOnStart = ""
  private var userScriptsOnStart: [String] = []
  private var textZoom = 100
  private var pullToRefreshEnabled = true
  private var pageUrl = ""
  private var urlObservation: NSKeyValueObservation?
  private var appStateObservers: [NSObjectProtocol] = []
  private var lastScrollY: CGFloat = 0
  private let refreshControl = UIRefreshControl()

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    let configuration = WKWebViewConfiguration()
    configuration.allowsInlineMediaPlayback = true
    configuration.allowsPictureInPictureMediaPlayback = true
    configuration.mediaTypesRequiringUserActionForPlayback = []
    configuration.websiteDataStore = .default()
    configuration.processPool = NouTubeView.sharedProcessPool


    let webView = WKWebView(frame: bounds, configuration: configuration)
    webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    webView.navigationDelegate = self
    webView.uiDelegate = self
    webView.allowsBackForwardNavigationGestures = true
    webView.scrollView.delegate = self
    webView.scrollView.contentInsetAdjustmentBehavior = .never
    if #available(iOS 16.4, *) {
      webView.isInspectable = true
    }
    self.webView = webView
    addSubview(webView)

    // WKWebView copies the configuration it is built with, so the handler has
    // to go on the copy the view actually uses -- registering it on the
    // configuration above would leave window.webkit.messageHandlers empty.
    webView.configuration.userContentController.add(WeakScriptMessageHandler(self), name: "nouTube")

    refreshControl.addTarget(self, action: #selector(handleRefresh), for: .valueChanged)
    webView.scrollView.refreshControl = refreshControl

    // Navigations inside the SPA never reach the navigation delegate, so the
    // url itself is what onLoad follows (Android uses doUpdateVisitedHistory).
    urlObservation = webView.observe(\.url, options: [.new]) { [weak self] _, _ in
      self?.emitUrlIfChanged()
    }

    // The page always reports itself visible (YouTube pauses mobile web when it
    // believes it is hidden), so the real app visibility is mirrored in here
    // instead -- content/background-guard.ts reads it to tell a YouTube pause
    // apart from one the user asked for.
    // WebKit suspends media decoding when the web process leaves the
    // foreground, so background audio only survives in Picture-in-Picture. The
    // request has to go out while the app is still active: once it has
    // backgrounded WebKit turns it down.
    appStateObservers.append(
      NotificationCenter.default.addObserver(
        forName: UIApplication.willResignActiveNotification,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        self?.enterPictureInPictureIfPlaying()
      }
    )

    for (name, background) in [
      (UIApplication.didEnterBackgroundNotification, true),
      (UIApplication.willEnterForegroundNotification, false),
    ] {
      let observer = NotificationCenter.default.addObserver(
        forName: name,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        self?.setBackground(background)
      }
      appStateObservers.append(observer)
    }

    rebuildUserScripts()
  }

  // One pool so the two views of the split watch layout share a session.
  private static let sharedProcessPool = WKProcessPool()

  deinit {
    appStateObservers.forEach(NotificationCenter.default.removeObserver)
    urlObservation?.invalidate()
    webView.configuration.userContentController.removeScriptMessageHandler(forName: "nouTube")
  }

  // MARK: - props

  func setScriptOnStart(_ script: String) {
    guard script != scriptOnStart else { return }
    scriptOnStart = script
    rebuildUserScripts()
  }

  func setUserScriptsOnStart(_ scripts: [String]) {
    guard scripts != userScriptsOnStart else { return }
    userScriptsOnStart = scripts
    rebuildUserScripts()
  }

  func setUserAgent(_ userAgent: String) {
    webView.customUserAgent = userAgent.isEmpty ? nil : userAgent
  }

  func setTextZoom(_ zoom: Int) {
    guard zoom != textZoom else { return }
    textZoom = zoom
    rebuildUserScripts()
    webView.evaluateJavaScript(textZoomScript, completionHandler: nil)
  }

  func setPullToRefreshEnabled(_ enabled: Bool) {
    pullToRefreshEnabled = enabled
    updateRefreshControl()
  }

  private func updateRefreshControl() {
    // /watch and /shorts scroll their own way; a refresh gesture there fights
    // the player.
    let allowed = pullToRefreshEnabled && !pageUrl.contains("/watch") && !pageUrl.contains("/shorts")
    webView.scrollView.refreshControl = allowed ? refreshControl : nil
  }

  @objc private func handleRefresh() {
    webView.reload()
  }

  // WKWebView has no textZoom of its own, so the zoom is a style rule the page
  // carries instead.
  private var textZoomScript: String {
    """
    (function () {
      var id = '_nou_text_zoom'
      var style = document.getElementById(id)
      if (!style) {
        style = document.createElement('style')
        style.id = id
        ;(document.head || document.documentElement).appendChild(style)
      }
      style.textContent = 'body, body * { -webkit-text-size-adjust: \(textZoom)% !important; }'
    })()
    """
  }

  private var bridgeScript: String {
    """
    window.NouTubeToken = '\(bridgeToken)';
    if (window.NouTubeBackground === undefined) { window.NouTubeBackground = false; }
    (function () {
      // WKWebView flips the page to hidden the moment the app leaves the
      // foreground, and YouTube pauses mobile web as soon as it sees that. The
      // Android view keeps the page visible from the native side instead
      // (NouWebView.onWindowVisibilityChanged); this is the same trick for
      // WebKit, which has no equivalent hook. The real app visibility still
      // reaches the page through window.NouTubeBackground.
      try {
        Object.defineProperty(document, 'hidden', {
          configurable: true,
          get: function () { return false },
        })
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: function () { return 'visible' },
        })
      } catch (e) {}
      // Swallowed in the capture phase so the page's own handlers never run.
      // Only the visibility events: pagehide and blur also fire on real
      // navigations, which YouTube needs for its own teardown.
      ;['visibilitychange', 'webkitvisibilitychange'].forEach(function (type) {
        document.addEventListener(type, function (e) { e.stopImmediatePropagation() }, true)
      })

      var post = function (name, body) {
        try {
          window.webkit.messageHandlers.nouTube.postMessage({ name: name, body: body })
        } catch (e) {}
      }
      window.NouTubeI = {
        onMessage: function (payload) { post('message', String(payload)) },
        notify: function (title, author, seconds, thumbnail) {
          post('notify', { title: title, author: author, seconds: seconds, thumbnail: thumbnail })
        },
        notifyProgress: function (playing, pos) {
          post('notifyProgress', { playing: playing, pos: pos })
        }
      }
    })();
    """
  }

  private func rebuildUserScripts() {
    let controller = webView.configuration.userContentController
    controller.removeAllUserScripts()

    let add = { (source: String, mainFrameOnly: Bool) in
      guard !source.isEmpty else { return }
      controller.addUserScript(
        WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: mainFrameOnly)
      )
    }

    add(bridgeScript, true)
    add(scriptOnStart, true)
    // Each user script is its own compilation unit: a syntax error in one must
    // not take the others, or the content bundle, down with it.
    for script in userScriptsOnStart {
      add(script, true)
    }
    add(textZoomScript, true)
  }

  // MARK: - events

  func emit(_ type: String, _ data: [String: Any]) {
    onMessage(["payload": ["type": type, "data": data]])
  }

  private func emitUrlIfChanged() {
    let url = webView.url?.absoluteString ?? ""
    guard !url.isEmpty, url != pageUrl else { return }
    pageUrl = url
    updateRefreshControl()
    onLoad(["url": url])
  }

  // MARK: - WKScriptMessageHandler

  public func userContentController(
    _ userContentController: WKUserContentController,
    didReceive message: WKScriptMessage
  ) {
    guard let dict = message.body as? [String: Any], let name = dict["name"] as? String else { return }
    switch name {
    case "message":
      guard let payload = dict["body"] as? String else { return }
      onMessage(["payload": payload])
    case "notify":
      guard let body = dict["body"] as? [String: Any] else { return }
      NouNowPlaying.shared.update(
        view: self,
        title: body["title"] as? String ?? "",
        author: body["author"] as? String ?? "",
        seconds: body["seconds"] as? Double ?? 0,
        thumbnail: body["thumbnail"] as? String ?? ""
      )
    case "notifyProgress":
      guard let body = dict["body"] as? [String: Any] else { return }
      let playing = body["playing"] as? Bool ?? false
      if playing {
        // Idempotent: the session is configured once, on the first play that
        // gets this far, and left alone afterwards.
        NouNowPlaying.shared.activateAudioSession()
      }
      NouNowPlaying.shared.updateProgress(
        view: self,
        playing: playing,
        position: body["pos"] as? Double ?? 0
      )
      UIApplication.shared.isIdleTimerDisabled = playing
    default:
      break
    }
  }

  // MARK: - WKNavigationDelegate

  public func webView(
    _ webView: WKWebView,
    decidePolicyFor navigationAction: WKNavigationAction,
    decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
  ) {
    guard let url = navigationAction.request.url else {
      decisionHandler(.allow)
      return
    }

    if url.scheme == "vnd.youtube.music" {
      emit("yt-music-desktop", [:])
      decisionHandler(.cancel)
      return
    }

    if blockHosts.contains(url.host?.lowercased() ?? "") {
      decisionHandler(.cancel)
      return
    }

    let scheme = url.scheme?.lowercased()
    if scheme == "http" || scheme == "https" {
      if navigationAction.targetFrame == nil || isInAppHost(url.host) {
        decisionHandler(.allow)
        return
      }
      decisionHandler(.cancel)
      UIApplication.shared.open(url)
      return
    }

    if scheme == "about" || scheme == "data" || scheme == "blob" {
      decisionHandler(.allow)
      return
    }

    decisionHandler(.cancel)
    UIApplication.shared.open(url)
  }

  public func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
    emitUrlIfChanged()
  }

  public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    refreshControl.endRefreshing()
    emitUrlIfChanged()
  }

  public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
    handleLoadError(error)
  }

  public func webView(
    _ webView: WKWebView,
    didFailProvisionalNavigation navigation: WKNavigation!,
    withError error: Error
  ) {
    handleLoadError(error)
  }

  private func handleLoadError(_ error: Error) {
    refreshControl.endRefreshing()
    let nsError = error as NSError
    // A cancelled navigation is what every in-page link looks like once the
    // next one supersedes it; it is not something to show the user.
    guard nsError.code != NSURLErrorCancelled else { return }
    emit("load-error", [
      "url": (nsError.userInfo[NSURLErrorFailingURLStringErrorKey] as? String) ?? pageUrl,
      "code": nsError.code,
      "description": nsError.localizedDescription,
      "canReload": true,
    ])
  }

  // MARK: - WKUIDelegate

  // target="_blank" has no window to open into here, so it navigates in place.
  public func webView(
    _ webView: WKWebView,
    createWebViewWith configuration: WKWebViewConfiguration,
    for navigationAction: WKNavigationAction,
    windowFeatures: WKWindowFeatures
  ) -> WKWebView? {
    if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
      if isInAppHost(url.host) {
        webView.load(navigationAction.request)
      } else {
        UIApplication.shared.open(url)
      }
    }
    return nil
  }

  // MARK: - UIScrollViewDelegate

  public func scrollViewDidScroll(_ scrollView: UIScrollView) {
    let y = scrollView.contentOffset.y
    let dy = lastScrollY - y
    lastScrollY = y
    emit("scroll", ["dy": dy, "y": y])
  }

  // MARK: - native surface

  func loadUrl(_ url: String) {
    guard let parsed = URL(string: url) else { return }
    webView.load(URLRequest(url: parsed))
  }

  func goBack() {
    if webView.canGoBack {
      webView.goBack()
    }
  }

  func clearData() async {
    let store = webView.configuration.websiteDataStore
    let types = WKWebsiteDataStore.allWebsiteDataTypes()
    let records = await store.dataRecords(ofTypes: types)
    await store.removeData(ofTypes: types, for: records)
  }

  // webkitSetPresentationMode is WebKit's own API; the standard
  // requestPictureInPicture() does not exist on iOS.
  private func enterPictureInPictureIfPlaying() {
    webView.evaluateJavaScript(
      """
      (function () {
        var v = document.querySelector('#movie_player video') || document.querySelector('video')
        if (!v || v.paused || v.ended) return 'no-video'
        if (typeof v.webkitSetPresentationMode !== 'function') return 'unsupported'
        if (v.webkitPresentationMode === 'picture-in-picture') return 'already'
        v.webkitSetPresentationMode('picture-in-picture')
        return 'requested'
      })()
      """
    )
  }

  func setBackground(_ background: Bool) {
    webView.evaluateJavaScript("window.NouTubeBackground = \(background)", completionHandler: nil)
  }

  // evaluateJavaScript answers with the value itself; the Android side answers
  // with its JSON minus the quotes around a plain string, and the JS callers
  // read both shapes, so match that.
  func evaluateJavaScript(_ script: String) async throws -> String? {
    try await withCheckedThrowingContinuation { continuation in
      DispatchQueue.main.async {
        self.webView.evaluateJavaScript(script) { value, error in
          if let error, (error as NSError).code != WKError.javaScriptResultTypeIsUnsupported.rawValue {
            continuation.resume(throwing: error)
            return
          }
          continuation.resume(returning: NouTubeView.stringify(value))
        }
      }
    }
  }

  // An expression that evaluates to a promise is awaited instead of coming back
  // as the JSON of a promise, which is "{}".
  func evaluateJavaScriptAsync(_ script: String) async throws -> String? {
    try await withCheckedThrowingContinuation { continuation in
      DispatchQueue.main.async {
        self.webView.callAsyncJavaScript(
          "return await (\(script))",
          arguments: [:],
          in: nil,
          in: .page
        ) { result in
          switch result {
          case .success(let value):
            continuation.resume(returning: NouTubeView.stringify(value))
          case .failure(let error):
            continuation.resume(throwing: error)
          }
        }
      }
    }
  }

  private static func stringify(_ value: Any?) -> String? {
    guard let value, !(value is NSNull) else { return nil }
    if let string = value as? String { return string }
    if let data = try? JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed]) {
      return String(data: data, encoding: .utf8)
    }
    return String(describing: value)
  }
}
