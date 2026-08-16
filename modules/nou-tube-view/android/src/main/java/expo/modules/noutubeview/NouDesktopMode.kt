package expo.modules.noutubeview

import android.content.Context
import android.os.Build
import android.view.Display
import android.view.WindowManager

/**
 * Android has no public "am I in desktop mode?" API, so we approximate it with
 * the two cases that actually put the app on a desktop-sized screen:
 *
 *  - the activity runs on a display other than the built-in one (an external
 *    monitor, which is what the DisplayMetricsHolder fix in the MainActivity
 *    plugin targets), or
 *  - Samsung DeX, which keeps the app on the default display id but flags the
 *    mode on its Configuration subclass.
 */
fun isSystemDesktopMode(context: Context?): Boolean {
  if (context == null) {
    return false
  }
  return isOnSecondaryDisplay(context) || isSamsungDesktopMode(context)
}

private fun isOnSecondaryDisplay(context: Context): Boolean {
  return try {
    val display =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        context.display
      } else {
        @Suppress("DEPRECATION")
        (context.getSystemService(Context.WINDOW_SERVICE) as? WindowManager)?.defaultDisplay
      }
    display != null && display.displayId != Display.DEFAULT_DISPLAY
  } catch (e: Exception) {
    // Non-visual context; assume the built-in screen.
    false
  }
}

private fun isSamsungDesktopMode(context: Context): Boolean {
  return try {
    val configuration = context.resources.configuration
    val configurationClass = configuration.javaClass
    val enabled = configurationClass.getField("semDesktopModeEnabled").getInt(configuration)
    val enabledConstant = configurationClass.getField("SEM_DESKTOP_MODE_ENABLED").getInt(configurationClass)
    enabled == enabledConstant
  } catch (e: Throwable) {
    // Not a Samsung ROM, or the field was renamed.
    false
  }
}
