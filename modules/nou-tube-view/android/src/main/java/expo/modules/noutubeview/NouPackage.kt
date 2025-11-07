package expo.modules.noutubeview

import android.app.Activity
import android.content.Context
import android.os.Build
import android.os.Build.VERSION
import android.os.Bundle
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

class NouActivityLifecycleListener : ReactActivityLifecycleListener {
  override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
    nouController.setActivity(activity)
  }
}

class NouPackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context): List<ReactActivityLifecycleListener> =
    listOf(NouActivityLifecycleListener())
}
