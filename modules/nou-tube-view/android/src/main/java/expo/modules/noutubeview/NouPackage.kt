package expo.modules.noutubeview

import android.app.Activity
import android.content.Context
import android.os.Build
import android.os.Build.VERSION
import android.os.Bundle
import android.window.OnBackInvokedDispatcher
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

class NouActivityLifecycleListener : ReactActivityLifecycleListener {
  override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
    nouController.setActivity(activity)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      activity.getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT) {
        nouController.goBack()
      }
    }
  }

  override fun onBackPressed(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      nouController.goBack()
      return true
    }
    return super.onBackPressed()
  }
}

class NouPackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context): List<ReactActivityLifecycleListener> =
    listOf(NouActivityLifecycleListener())
}
