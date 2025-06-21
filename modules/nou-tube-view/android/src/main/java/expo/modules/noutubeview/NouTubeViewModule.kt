package expo.modules.noutubeview

import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NouTubeViewModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NouTubeView")

    View(NouTubeView::class) {
      Prop("url") { view: NouTubeView, url: String ->
        view.webView.loadUrl(url)
      }
      Prop("scriptOnStart") { view: NouTubeView, script: String ->
        view.setScriptOnStart(script)
      }
      Events("onLoad", "onMessage")

      AsyncFunction("eval") Coroutine { view: NouTubeView, script: String ->
        return@Coroutine view.webView.eval(script)
      }
    }
  }
}
