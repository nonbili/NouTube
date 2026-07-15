import NouTubeViewModule from '@/modules/nou-tube-view'

const normalizeLanguageTag = (tag: string) => {
  const baseTag = tag.replace('_', '-').split('-')[0].toLowerCase()
  return baseTag === 'und' ? '' : baseTag
}

export const getTranslationSupportedLanguages = () => NouTubeViewModule.getTranslationSupportedLanguages()

export const translateText = async (text: string, targetLanguage: string) => {
  const result = await NouTubeViewModule.translateText(text, normalizeLanguageTag(targetLanguage))
  return { ...result, sourceLanguage: result.sourceLanguage ? normalizeLanguageTag(result.sourceLanguage) : undefined }
}
