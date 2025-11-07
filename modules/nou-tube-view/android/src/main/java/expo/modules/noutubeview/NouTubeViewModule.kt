package expo.modules.noutubeview

import androidx.appcompat.app.AppCompatDelegate
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NouTubeViewModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NouTubeView")

    Function("setTheme") { theme: String? ->
      var mode = AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
      if (theme == "dark") {
        mode = AppCompatDelegate.MODE_NIGHT_YES
      } else if (theme == "light") {
        mode = AppCompatDelegate.MODE_NIGHT_NO
      }
      AppCompatDelegate.setDefaultNightMode(mode)
    }

    View(NouTubeView::class) {
      Prop("scriptOnStart") { view: NouTubeView, script: String ->
        view.setScriptOnStart(script)
      }
      Events("onLoad", "onMessage")

      AsyncFunction("clearData") { view: NouTubeView -> view.clearData() }

      AsyncFunction("executeJavaScript") Coroutine
        { view: NouTubeView, script: String ->
          return@Coroutine view.webView.eval(script)
        }

      AsyncFunction("goBack") { view: NouTubeView ->
        val webView = view.webView
        if (webView.canGoBack()) {
          webView.goBack()
        } else {
          view.currentActivity?.finish()
        }
      }

      AsyncFunction("loadUrl") { view: NouTubeView, url: String ->
        view.webView.loadUrl(url)
      }
    }
  }
}
