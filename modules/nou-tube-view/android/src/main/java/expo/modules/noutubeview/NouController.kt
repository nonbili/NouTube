package expo.modules.noutubeview

typealias LogFn = (String) -> Unit

class NouController {
  internal var service: NouService? = null
  internal var logFn: LogFn? = null

  fun log(msg: String) {
    logFn?.invoke(msg)
  }

  fun exit() {
    service?.exit()
  }
}

val nouController = NouController()
