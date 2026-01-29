import ExpoModulesCore
import UIKit
import WebKit

class NouTubeView: ExpoView, WKNavigationDelegate, WKScriptMessageHandler {
  let webView: WKWebView
  var scriptOnStart: String = ""
  
  let onLoad = EventDispatcher()
  let onMessage = EventDispatcher()

  private var urlObservation: NSKeyValueObservation?
  private var lastUrl: String?
  private var lifecycleObservers: [NSObjectProtocol] = []

  required init(appContext: AppContext? = nil) {
    let configuration = WKWebViewConfiguration()
    configuration.allowsAirPlayForMediaPlayback = true
    configuration.allowsInlineMediaPlayback = true
    configuration.allowsPictureInPictureMediaPlayback = true
    configuration.mediaTypesRequiringUserActionForPlayback = []
    if #available(iOS 15.4, *) {
      configuration.preferences.isElementFullscreenEnabled = true
    }

    webView = WKWebView(frame: .zero, configuration: configuration)
    super.init(appContext: appContext)

    webView.navigationDelegate = self
    webView.configuration.userContentController.add(self, name: "NouTubeI")
    nouController.commandFn = { [weak self] script in
      self?.webView.evaluateJavaScript(script, completionHandler: nil)
    }

    webView.scrollView.showsHorizontalScrollIndicator = false
    webView.scrollView.alwaysBounceHorizontal = false
    webView.scrollView.bounces = false
    webView.scrollView.isDirectionalLockEnabled = true
    if #available(iOS 11.0, *) {
      webView.scrollView.contentInsetAdjustmentBehavior = .never
    }

    urlObservation = webView.observe(\.url, options: .new) { [weak self] webView, _ in
      self?.handleUrlChange()
    }

    #if DEBUG
    if #available(iOS 16.4, *) {
      webView.isInspectable = true
    }
    #endif

    registerLifecycleObservers()
    addSubview(webView)
  }

  deinit {
    nouController.updatePlaybackSession(active: false)
    urlObservation?.invalidate()
    lifecycleObservers.forEach(NotificationCenter.default.removeObserver)
    webView.configuration.userContentController.removeScriptMessageHandler(forName: "NouTubeI")
  }

  override func layoutSubviews() {
    webView.frame = bounds
  }

  private func handleUrlChange() {
    guard let url = webView.url?.absoluteString, url != lastUrl else { return }
    lastUrl = url
    onLoad(["url": url])
  }

  private func registerLifecycleObservers() {
    let center = NotificationCenter.default
    lifecycleObservers = [
      center.addObserver(
        forName: UIApplication.willResignActiveNotification,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        self?.prepareForBackgroundPlayback()
      }
    ]
  }

  private func prepareForBackgroundPlayback() {
    nouController.preparePlaybackSession()
    let script = """
    (function() {
      try {
        if (window.NouTube?.prepareForBackground) {
          return window.NouTube.prepareForBackground();
        }
        const video = document.querySelector('#movie_player video');
        if (!video) return false;
        if (video.webkitPresentationMode === 'picture-in-picture' || document.pictureInPictureElement === video) {
          return 'already';
        }
        if (typeof video.webkitSetPresentationMode === 'function') {
          if (video.webkitPresentationMode !== 'picture-in-picture') {
            video.webkitSetPresentationMode('picture-in-picture');
          }
          return true;
        }
        if (typeof video.requestPictureInPicture === 'function') {
          video.requestPictureInPicture();
          return true;
        }
        if (typeof video.webkitEnterFullscreen === 'function' && !video.webkitDisplayingFullscreen) {
          video.webkitEnterFullscreen();
          return true;
        }
        return false;
      } catch (error) {
        return String(error);
      }
    })();
    """
    webView.evaluateJavaScript(script) { result, error in
      if let error {
        nouController.log("prepareForBackgroundPlayback failed: \(error.localizedDescription)")
      } else if let result {
        nouController.log("prepareForBackgroundPlayback: \(result)")
      }
    }
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
    nouController.updatePlaybackSession(active: false)
    nouController.clearNowPlaying()

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
    
    handleUrlChange()
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
          let seconds = (body["seconds"] as? NSNumber)?.int64Value ?? 0
          let thumbnail = body["thumbnail"] as? String ?? ""
          nouController.preparePlaybackSession()
          nouController.updateNowPlaying(title: title, author: author, duration: seconds)
          nouController.log("notify: \(title) by \(author), duration: \(seconds)s, thumb: \(thumbnail)")
        case "notifyProgress":
          // Android equivalent: notifyProgress(playing, pos)
          let playing = (body["playing"] as? NSNumber)?.boolValue ?? false
          let pos = (body["pos"] as? NSNumber)?.doubleValue ?? 0
          nouController.updatePlaybackSession(active: playing)
          nouController.updatePlaybackProgress(playing: playing, position: pos)
          nouController.log("notifyProgress: playing=\(playing), pos=\(pos)")
        default:
          break
        }
      }
    }
  }
}
