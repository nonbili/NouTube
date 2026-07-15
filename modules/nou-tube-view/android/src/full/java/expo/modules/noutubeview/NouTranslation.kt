package expo.modules.noutubeview

import com.google.android.gms.tasks.Tasks
import com.google.mlkit.nl.languageid.LanguageIdentification
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.TranslatorOptions

object NouTranslation {
  fun translateText(text: String, targetLanguage: String): Map<String, String> {
    // ML Kit uses base tags for Chinese and Portuguese, while the UI stores
    // BCP-47 variants so those languages can be distinguished where supported.
    val mlKitTargetLanguage = when {
      targetLanguage.startsWith("zh", ignoreCase = true) -> "zh"
      targetLanguage.startsWith("pt", ignoreCase = true) -> "pt"
      else -> targetLanguage
    }
    val target = TranslateLanguage.fromLanguageTag(mlKitTargetLanguage)
      ?: throw IllegalArgumentException("Translation target is unavailable")
    val identifier = LanguageIdentification.getClient()
    val detected = try {
      Tasks.await(identifier.identifyLanguage(text))
    } finally {
      identifier.close()
    }
    val source = TranslateLanguage.fromLanguageTag(detected)
      ?: throw IllegalArgumentException("Could not identify the source language")
    if (source == target) {
      return mapOf("text" to text, "sourceLanguage" to source)
    }

    val translator = Translation.getClient(
      TranslatorOptions.Builder().setSourceLanguage(source).setTargetLanguage(target).build()
    )
    try {
      Tasks.await(translator.downloadModelIfNeeded())
      val translated = text.lineSequence().joinToString("\n") { line ->
        if (line.isBlank()) line else Tasks.await(translator.translate(line))
      }
      return mapOf("text" to translated, "sourceLanguage" to source)
    } finally {
      translator.close()
    }
  }

  fun getSupportedLanguages(): List<String> = TranslateLanguage.getAllLanguages()
}
