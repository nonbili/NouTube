package expo.modules.noutubeview

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.pm.PackageManager
import android.graphics.Rect
import android.os.Build
import android.util.Log
import android.util.Rational
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver

// Android's WebView has no Picture-in-Picture API of its own, so PiP is driven
// from here: the page reports the video it is playing (NouJsInterface
// .setPictureInPictureVideo), MainActivity forwards the two activity callbacks
// (see plugins/withAndroidPlugin.ts), and the page then shrinks itself to the
// bare video (content/picture-in-picture.ts).
//
// Nothing is reparented natively: React Native owns the layout of everything
// above the webview and never re-measures a view moved behind its back, which
// left SwipeRefreshLayout drawing a child index it no longer had. The chrome is
// hidden from JS instead, where the layout pass happens for real.
//
// Main thread only.
object NouPictureInPicture {
  private const val TAG = "NouTubePiP"

  // The system rejects anything outside these bounds.
  private const val MIN_ASPECT_RATIO = 1.0 / 2.39
  private const val MAX_ASPECT_RATIO = 2.39

  private var view: NouTubeView? = null
  private var videoSize: Pair<Int, Int>? = null
  private var active = false
  private var chromeHidden = false
  private val hiddenViews = mutableSetOf<View>()
  // The webview and every ancestor it is clipped by, with the bounds React
  // Native last gave them.
  private val stretchedViews = mutableListOf<Pair<View, Rect>>()
  private var decorView: View? = null
  private val decorLayoutListener =
    View.OnLayoutChangeListener { _, _, _, _, _, _, _, _, _ -> fillWindow() }

  private val decorPreDrawListener = ViewTreeObserver.OnPreDrawListener {
    // A later React Native commit can make siblings visible again after entry.
    // Enforce the PiP presentation after layout, immediately before drawing.
    hideChrome()
    fillWindow()
    true
  }

  internal var emitEvent: ((Boolean) -> Unit)? = null

  private val autoEnterSupported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S

  private fun isSupported(activity: Activity) =
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
      activity.packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)

  private fun paramsFor(size: Pair<Int, Int>, autoEnter: Boolean): PictureInPictureParams {
    val ratio = (size.first.toDouble() / size.second).coerceIn(MIN_ASPECT_RATIO, MAX_ASPECT_RATIO)
    val builder = PictureInPictureParams.Builder().setAspectRatio(Rational((ratio * 1000).toInt(), 1000))
    // Where the video is coming from: without it the transition fits the whole
    // window, and the crop it leaves behind is the window inset by the system
    // bars, showing as bands of task background in the pinned window.
    view?.let { source ->
      val hint = Rect()
      if (source.getGlobalVisibleRect(hint) && !hint.isEmpty) {
        builder.setSourceRectHint(hint)
      }
    }
    if (autoEnterSupported) {
      builder.setAutoEnterEnabled(autoEnter)
    }
    return builder.build()
  }

  // The page reports the video PiP would show whenever it changes, and a zero
  // size once there is nothing to show -- paused, ended, or navigated away.
  // Keeping the size here is what lets onUserLeaveHint enter PiP synchronously:
  // asking the page for it there answers after the activity has paused, and
  // enterPictureInPictureMode then throws "Activity must be resumed".
  fun setVideo(view: NouTubeView, width: Int, height: Int) {
    val size = if (width > 0 && height > 0) width to height else null
    // A view without a video only speaks for itself; the one that has one takes
    // over, so the modal player and the main webview cannot disarm each other.
    if (size == null && this.view !== view) {
      return
    }
    if (size != null) {
      this.view = view
    }
    if (size == videoSize) {
      return
    }
    videoSize = size
    updateParams(view.currentActivity ?: return)
  }

  fun onViewDetached(view: NouTubeView) {
    if (this.view !== view) {
      return
    }
    releaseWindow()
    this.view = null
    videoSize = null
  }

  // On Android 12+ the system enters PiP itself on the home gesture, which
  // animates far better than entering from onUserLeaveHint. Arming it is just
  // keeping the activity's params up to date with what is playing.
  private fun updateParams(activity: Activity) {
    if (!autoEnterSupported || !isSupported(activity)) {
      return
    }
    try {
      activity.setPictureInPictureParams(paramsFor(videoSize ?: (16 to 9), videoSize != null))
    } catch (error: Exception) {
      Log.w(TAG, "Unable to update picture-in-picture params", error)
    }
  }

  // React Native commits its layout through the resumed activity, so a tree
  // committed after the window has been pinned never reaches it: the chrome has
  // to be told to step aside on the way out, not once PiP has started.
  private fun setChromeHidden(hidden: Boolean) {
    if (chromeHidden == hidden) {
      return
    }
    chromeHidden = hidden
    emitEvent?.invoke(hidden)
  }

  fun onUserLeaveHint(activity: Activity) {
    if (!isSupported(activity) || activity.isInPictureInPictureMode || videoSize == null) {
      return
    }
    setChromeHidden(true)
    // Android 12+ enters PiP itself from the params above, and does it with a
    // proper transition; entering by hand from here is the older path.
    if (autoEnterSupported) {
      return
    }
    val size = videoSize ?: return
    // YouTube reads the outer window size to detect backgrounding, so the page
    // has to be patched before the window shrinks -- fire and forget, waiting
    // for the answer is what broke entry in the first place.
    view?.webView?.evaluateJavascript("window.NouTube?.preparePictureInPicture?.()", null)
    try {
      activity.enterPictureInPictureMode(paramsFor(size, false))
    } catch (error: Exception) {
      Log.w(TAG, "Unable to enter picture-in-picture", error)
      setChromeHidden(false)
    }
  }

  // Leaving the app does not always end in PiP -- it can be turned off for the
  // app in system settings, or playback stopped on the way out -- so the chrome
  // comes back for whatever the user returns to (NouTubeView drives this off
  // the real window visibility, which PiP itself never changes).
  fun onWindowVisible() {
    if (active) {
      return
    }
    setChromeHidden(false)
  }

  fun onModeChanged(activity: Activity, inPictureInPicture: Boolean) {
    if (active == inPictureInPicture) {
      return
    }
    active = inPictureInPicture
    setChromeHidden(inPictureInPicture)
    if (inPictureInPicture) {
      takeOverWindow(activity)
    } else {
      releaseWindow()
    }
    view?.webView?.evaluateJavascript(
      "window.NouTube?.setPictureInPicture?.($inPictureInPicture)?.catch?.(console.error)",
      null,
    )
  }

  // React Native lays its tree out from the shadow tree of a resumed activity,
  // so nothing it commits reaches the pinned window: the webview would keep the
  // bounds -- and the page the viewport -- it had before PiP started. Measure
  // and lay it out onto the window here instead, and hide what it used to share
  // the window with.
  //
  // The view tree itself is left alone. Moving the webview out of its parent is
  // what crashed before: SwipeRefreshLayout caches the index of its progress
  // circle in onMeasure and draws by it, and React Native runs no measure pass
  // to correct it.
  private fun takeOverWindow(activity: Activity) {
    val view = view ?: return
    val decor = activity.window?.decorView ?: return
    decorView = decor
    hideChrome()
    // The webview alone is not enough: its ancestors keep the bounds React
    // Native gave them for the full screen -- the one below the toolbar, say --
    // and clip the webview back down to a band of the pinned window.
    stretchedViews.clear()
    var node: View = view
    while (node !== decor) {
      stretchedViews.add(node to Rect(node.left, node.top, node.right, node.bottom))
      node = node.parent as? View ?: break
    }
    // The window keeps resizing after this -- the transition animates, and the
    // user can resize the PiP window -- so follow it.
    decor.addOnLayoutChangeListener(decorLayoutListener)
    decor.viewTreeObserver.addOnPreDrawListener(decorPreDrawListener)
    fillWindow()
    // Placing the views by hand never asks the window for a traversal of its
    // own, so ask for one, then place them again once it has been through.
    decor.requestLayout()
    decor.post { fillWindow() }
  }

  private fun hideChrome() {
    val decor = decorView ?: return
    // INVISIBLE, not GONE: it only invalidates, where GONE would ask for the
    // layout pass React Native is not running.
    var child: View = view ?: return
    var parent = child.parent as? ViewGroup
    while (parent != null) {
      for (index in 0 until parent.childCount) {
        val sibling = parent.getChildAt(index)
        if (sibling !== child && sibling.visibility == View.VISIBLE) {
          sibling.visibility = View.INVISIBLE
          hiddenViews.add(sibling)
        }
      }
      if (parent === decor) {
        break
      }
      child = parent
      parent = parent.parent as? ViewGroup
    }
  }

  private fun fillWindow() {
    val decor = decorView ?: return
    if (decor.width <= 0 || decor.height <= 0) {
      return
    }
    // Outermost first: React Native lays out its children itself, so measuring
    // an ancestor moves nothing on its own -- each view is placed by hand.
    for ((node, _) in stretchedViews.asReversed()) {
      if (node.left == 0 && node.top == 0 && node.width == decor.width &&
        node.height == decor.height && !node.isLayoutRequested) {
        continue
      }
      node.measure(
        View.MeasureSpec.makeMeasureSpec(decor.width, View.MeasureSpec.EXACTLY),
        View.MeasureSpec.makeMeasureSpec(decor.height, View.MeasureSpec.EXACTLY),
      )
      node.layout(0, 0, decor.width, decor.height)
    }
  }

  private fun releaseWindow() {
    decorView?.removeOnLayoutChangeListener(decorLayoutListener)
    decorView?.viewTreeObserver?.takeIf { it.isAlive }?.removeOnPreDrawListener(decorPreDrawListener)
    decorView = null
    hiddenViews.forEach { it.visibility = View.VISIBLE }
    hiddenViews.clear()
    // Back to where React Native had them; its next commit takes over from here.
    for ((node, bounds) in stretchedViews.asReversed()) {
      node.measure(
        View.MeasureSpec.makeMeasureSpec(bounds.width(), View.MeasureSpec.EXACTLY),
        View.MeasureSpec.makeMeasureSpec(bounds.height(), View.MeasureSpec.EXACTLY),
      )
      node.layout(bounds.left, bounds.top, bounds.right, bounds.bottom)
    }
    stretchedViews.clear()
  }
}
