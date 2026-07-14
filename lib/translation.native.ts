import FastTranslator, { type Languages } from 'fast-mlkit-translate-text'

const normalizeLanguageTag = (tag: string) => {
  const baseTag = tag.replace('_', '-').split('-')[0].toLowerCase()
  return baseTag === 'und' ? '' : baseTag
}

const languageForTag = (tag: string): Languages => {
  const language = FastTranslator.languageFromTag(normalizeLanguageTag(tag))
  if (!language) {
    throw new Error(`Translation language is unavailable: ${tag}`)
  }
  return language
}

export const getTranslationSupportedLanguages = () => FastTranslator.languageTags

export const translateText = async (text: string, targetLanguage: string) => {
  const sourceLanguage = normalizeLanguageTag(await FastTranslator.identify(text))
  if (!sourceLanguage) {
    throw new Error('Could not identify the source language')
  }

  const source = languageForTag(sourceLanguage)
  const target = languageForTag(targetLanguage)
  if (source === target) {
    return { text, sourceLanguage }
  }

  await FastTranslator.prepare({ source, target, downloadIfNeeded: true })
  const translatedLines: string[] = []
  for (const line of text.split('\n')) {
    translatedLines.push(line.trim() ? await FastTranslator.translate(line) : line)
  }
  return { text: translatedLines.join('\n'), sourceLanguage }
}
