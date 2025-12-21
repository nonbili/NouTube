package expo.modules.noutubeview

typealias LogFn = (String) -> Unit

class NouController {
  fun log(msg: String) {
    logFn?.invoke(msg)
  }
}

val nouController = NouController()
