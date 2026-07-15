package expo.modules.noutubeview

object NouTranslation {
  fun translateText(
    @Suppress("UNUSED_PARAMETER") text: String,
    @Suppress("UNUSED_PARAMETER") targetLanguage: String,
  ): Map<String, String> {
    throw IllegalStateException("Translation is unavailable in the FOSS build")
  }

  fun getSupportedLanguages(): List<String> = emptyList()
}
