import { describe, expect, it } from 'bun:test'
import { resolveTextClass } from './text-class'

const resolve = (className?: string) => resolveTextClass('text-zinc-900', 'dark:text-gray-100', className)

describe('resolveTextClass', () => {
  it('keeps both base colors when nothing is passed', () => {
    expect(resolve()).toBe('text-zinc-900 dark:text-gray-100')
    expect(resolve('')).toBe('text-zinc-900 dark:text-gray-100')
  })

  it('keeps both base colors for non-color text utilities', () => {
    expect(resolve('text-sm font-semibold')).toBe('text-zinc-900 dark:text-gray-100 text-sm font-semibold')
    expect(resolve('text-center')).toBe('text-zinc-900 dark:text-gray-100 text-center')
    expect(resolve('text-[13px]')).toBe('text-zinc-900 dark:text-gray-100 text-[13px]')
  })

  it('drops the light base color when the caller sets one', () => {
    expect(resolve('text-white')).toBe('dark:text-gray-100 text-white')
    expect(resolve('flex-1 text-zinc-500')).toBe('dark:text-gray-100 flex-1 text-zinc-500')
    expect(resolve('text-[#ff0000]')).toBe('dark:text-gray-100 text-[#ff0000]')
    expect(resolve('text-black/50')).toBe('dark:text-gray-100 text-black/50')
  })

  it('drops the dark base color when the caller sets one', () => {
    expect(resolve('dark:text-zinc-900')).toBe('text-zinc-900 dark:text-zinc-900')
  })

  it('drops both base colors when the caller sets both', () => {
    expect(resolve('text-white dark:text-zinc-900')).toBe('text-white dark:text-zinc-900')
  })

  it('does not treat a dark override as a light one', () => {
    expect(resolve('dark:text-indigo-700')).toBe('text-zinc-900 dark:text-indigo-700')
  })

  it('ignores classes that merely end in a color-like suffix', () => {
    expect(resolve('mt-3 border-red-500')).toBe('text-zinc-900 dark:text-gray-100 mt-3 border-red-500')
  })
})
