export const getTranslationSupportedLanguages = (): string[] => []

export const translateText = async (_text: string, _targetLanguage: string) => {
  throw new Error('Translation is unavailable on this platform')
}
