import Foundation

typealias LogFn = (String) -> Void

class NouController {
    static let shared = NouController()
    
    var logFn: LogFn?
    
    func log(_ msg: String) {
        logFn?(msg)
    }

    func exit() {
        // iOS apps generally don't "exit" themselves, but we can provide the interface.
        log("exit called")
    }
}

let nouController = NouController.shared
