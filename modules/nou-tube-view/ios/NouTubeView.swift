import ExpoModulesCore
import WebKit

class NouTubeView: ExpoView, WKNavigationDelegate, WKScriptMessageHandler {
  let webView: WKWebView
  var scriptOnStart: String = ""
  
  let onLoad = EventDispatcher()
  let onMessage = EventDispatcher()

  required init(appContext: AppContext? = nil) {
    let configuration = WKWebViewConfiguration()
    webView = WKWebView(frame: .zero, configuration: configuration)
    super.init(appContext: appContext)

    webView.navigationDelegate = self
    webView.configuration.userContentController.add(self, name: "NouTubeI")

    #if DEBUG
    if #available(iOS 16.4, *) {
      webView.isInspectable = true
    }
    #endif
    
    addSubview(webView)
  }

  override func layoutSubviews() {
    webView.frame = bounds
  }

  func clearData() {
    let dataTypes = WKWebsiteDataStore.allWebsiteDataTypes()
    let dateFrom = Date(timeIntervalSince1970: 0)
    WKWebsiteDataStore.default().removeData(ofTypes: dataTypes, modifiedSince: dateFrom) { [weak self] in
      self?.webView.reload()
    }
  }

  // MARK: - WKNavigationDelegate
  
  func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
    let shim = """
    (function() {
      if (window.NouTubeI) return;
      window.NouTubeI = {
        onMessage: function(payload) {
          window.webkit.messageHandlers.NouTubeI.postMessage({ method: 'onMessage', payload: payload });
        },
        notify: function(title, author, seconds, thumbnail) {
          window.webkit.messageHandlers.NouTubeI.postMessage({ method: 'notify', title: title, author: author, seconds: seconds, thumbnail: thumbnail });
        },
        notifyProgress: function(playing, pos) {
          window.webkit.messageHandlers.NouTubeI.postMessage({ method: 'notifyProgress', playing: playing, pos: pos });
        }
      };
    })();
    """
    webView.evaluateJavaScript(shim, completionHandler: nil)
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    if !scriptOnStart.isEmpty {
      webView.evaluateJavaScript(scriptOnStart, completionHandler: nil)
    }
    
    if let url = webView.url?.absoluteString {
      onLoad([
        "url": url
      ])
    }
  }

  // MARK: - WKScriptMessageHandler

  func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    if message.name == "NouTubeI" {
      if let body = message.body as? String {
        onMessage([
          "payload": body
        ])
      } else if let body = message.body as? [String: Any], let method = body["method"] as? String {
        // Handle method calls from JS bridge
        switch method {
        case "onMessage":
          if let payload = body["payload"] as? String {
            onMessage(["payload": payload])
          }
        case "notify":
          // Android equivalent: notify(title, author, seconds, thumbnail)
          let title = body["title"] as? String ?? ""
          let author = body["author"] as? String ?? ""
          let seconds = body["seconds"] as? Int64 ?? 0
          let thumbnail = body["thumbnail"] as? String ?? ""
          nouController.log("notify: \(title) by \(author), duration: \(seconds)s, thumb: \(thumbnail)")
        case "notifyProgress":
          // Android equivalent: notifyProgress(playing, pos)
          let playing = body["playing"] as? Bool ?? false
          let pos = body["pos"] as? Double ?? 0
          nouController.log("notifyProgress: playing=\(playing), pos=\(pos)")
        default:
          break
        }
      }
    }
  }
}
