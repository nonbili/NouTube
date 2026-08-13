import { describe, expect, it } from 'bun:test'
import { t } from 'i18next'
import './i18n'

describe('i18n', () => {
  it('does not HTML-escape interpolated user content', () => {
    expect(t('bookmarks.moved', { lng: 'en', folder: "Dad's & Rock" })).toBe("Moved to Dad's & Rock")
  })
})
