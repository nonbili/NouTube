package expo.modules.noutubeview

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class YouTubeVideoUrlTest {
  @Test
  fun acceptsYouTubeVideoUrls() {
    assertTrue(isYouTubeVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"))
    assertTrue(isYouTubeVideoUrl("https://m.youtube.com/shorts/dQw4w9WgXcQ"))
    assertTrue(isYouTubeVideoUrl("https://www.youtube.com/live/dQw4w9WgXcQ"))
    assertTrue(isYouTubeVideoUrl("https://youtu.be/dQw4w9WgXcQ"))
  }

  @Test
  fun rejectsNonVideoAndNonYouTubeUrls() {
    assertFalse(isYouTubeVideoUrl("https://www.youtube.com/@channel"))
    assertFalse(isYouTubeVideoUrl("https://www.youtube.com/watch"))
    assertFalse(isYouTubeVideoUrl("https://example.com/watch?v=dQw4w9WgXcQ"))
    assertFalse(isYouTubeVideoUrl("not a URL"))
  }
}
