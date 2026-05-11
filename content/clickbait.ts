// Replace YouTube clickbait thumbnails with auto-generated frame snapshots.
// Adapted from https://github.com/pietervanheijningen/clickbait-remover-for-youtube (MIT).
const THUMB_RE =
  /^(https?:\/\/i\d?\.ytimg\.com\/(?:vi|vi_webp)\/[^/]+\/)(default|mqdefault|hqdefault|sddefault|hq720|hq1|hq2|hq3|maxresdefault)(_custom_\d+)?(\.[a-zA-Z0-9]+)(.*)$/

function transformUrl(url: string, target: string): string {
  const m = THUMB_RE.exec(url)
  if (!m || m[2] === target) return url
  return `${m[1]}${target}${m[4]}${m[5]}`
}

function transformStyle(value: string, target: string): string {
  return value.replace(
    /(https?:\/\/i\d?\.ytimg\.com\/(?:vi|vi_webp)\/[^/]+\/)(default|mqdefault|hqdefault|sddefault|hq720|hq1|hq2|hq3|maxresdefault)(_custom_\d+)?(\.[a-zA-Z0-9]+)/g,
    `$1${target}$4`,
  )
}

export function installClickbaitThumbnails(target: string) {
  if (!target || target === 'default') return

  try {
    const desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')
    if (desc?.set && desc.get) {
      const origSet = desc.set
      const origGet = desc.get
      Object.defineProperty(HTMLImageElement.prototype, 'src', {
        configurable: true,
        enumerable: true,
        get() {
          return origGet.call(this)
        },
        set(value: string) {
          origSet.call(this, typeof value === 'string' ? transformUrl(value, target) : value)
        },
      })
    }
  } catch (e) {}

  try {
    const origSetAttribute = Element.prototype.setAttribute
    Element.prototype.setAttribute = function (name: string, value: string) {
      if (this instanceof HTMLImageElement && name === 'src' && typeof value === 'string') {
        return origSetAttribute.call(this, name, transformUrl(value, target))
      }
      return origSetAttribute.call(this, name, value)
    }
  } catch (e) {}

  const sweep = () => {
    document.querySelectorAll('img').forEach((img) => {
      const current = img.getAttribute('src')
      if (current) {
        const next = transformUrl(current, target)
        if (next !== current) img.setAttribute('src', next)
      }
    })
    document
      .querySelectorAll<HTMLElement>('[style*="ytimg.com"]')
      .forEach((el) => {
        const s = el.getAttribute('style')
        if (s) {
          const next = transformStyle(s, target)
          if (next !== s) el.setAttribute('style', next)
        }
      })
  }

  if (document.body) sweep()
  document.addEventListener('DOMContentLoaded', sweep)
  setTimeout(sweep, 1000)
  setTimeout(sweep, 3000)
}
