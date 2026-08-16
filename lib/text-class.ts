// Tailwind resolves conflicting utilities by stylesheet order, not by the order
// they appear in a className string, so a caller passing `text-white` to a
// component whose base class is `text-zinc-900` still renders zinc-900 (zinc is
// emitted after white in the palette). Drop the base color whenever the caller
// already provides one for the same variant.

// `text-[13px]` is a size, so only arbitrary values that look like a color count.
const colorClass = String.raw`text-(?:inherit|current|transparent|black|white|\[(?:#|rgb|hsl|--)[^\]]*\]|[a-z]+-\d{2,3})(?:\/\d{1,3})?`

const hasLightColor = new RegExp(String.raw`(?:^|\s)${colorClass}(?=\s|$)`)
const hasDarkColor = new RegExp(String.raw`(?:^|\s)dark:${colorClass}(?=\s|$)`)

export function resolveTextClass(baseLight: string, baseDark: string, className?: string): string {
  const overrides = className ?? ''
  return [hasLightColor.test(overrides) ? '' : baseLight, hasDarkColor.test(overrides) ? '' : baseDark, overrides]
    .filter(Boolean)
    .join(' ')
}
