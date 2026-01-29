import ExpoModulesCore

public class NouTubeViewModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NouTubeView")

    Events("log")

    OnCreate {
      nouController.logFn = { [weak self] msg in
        self?.sendEvent("log", [
          "msg": msg
        ])
      }
    }
    Function("setTheme") { (theme: String?) in
      let style: UIUserInterfaceStyle
      switch theme {
      case "dark":
        style = .dark
      case "light":
        style = .light
      default:
        style = .unspecified
      }

      DispatchQueue.main.async {
        if #available(iOS 13.0, *) {
          UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .forEach { window in
              window.overrideUserInterfaceStyle = style
            }
        }
      }
    }
 
    Function("exit") {
      nouController.exit()
    }
 
    View(NouTubeView.self) {
      Prop("scriptOnStart") { (view: NouTubeView, script: String) in
        view.scriptOnStart = script
      }

      Prop("useragent") { (view: NouTubeView, ua: String) in
        view.webView.customUserAgent = ua
      }

      Events("onLoad", "onMessage")

      AsyncFunction("clearData") { (view: NouTubeView) in
        view.clearData()
      }

      AsyncFunction("executeJavaScript") { (view: NouTubeView, script: String, promise: Promise) in
        view.webView.evaluateJavaScript(script) { (result, error) in
          if let error = error {
            promise.reject(error)
          } else {
            promise.resolve(result as? String ?? "")
          }
        }
      }

      AsyncFunction("goBack") { (view: NouTubeView) in
        if view.webView.canGoBack {
          view.webView.goBack()
        }
      }

      AsyncFunction("loadUrl") { (view: NouTubeView, url: String) in
        if let url = URL(string: url) {
          view.webView.load(URLRequest(url: url))
        }
      }
    }
  }
}
