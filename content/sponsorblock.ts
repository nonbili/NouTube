export interface Segment {
  // https://wiki.sponsor.ajay.app/w/Types#Category
  category: string
  actionType: string
  segment: [number, number]
}

export function isSponsorBlockEnabled() {
  const value = localStorage.getItem('nou:settings')
  if (!value) {
    return false
  }
  try {
    const settings = JSON.parse(value)
    return settings.sponsorBlock
  } catch (e) {
    return false
  }
}

// https://wiki.sponsor.ajay.app/w/Types#Category
const categoryColors: Record<string, string> = {
  sponsor: '#00d400',
  selfpromo: '#ffff00',
  interaction: '#cc00ff',
  intro: '#00ffff',
  outro: '#0202ed',
  preview: '#008fd6',
  music_offtopic: '#ff9900',
  poi_highlight: '#ff1684',
  filler: '#7300ff',
}

const overlayClass = '_nou_sb_segments'
const segmentClass = '_nou_sb_segment'

// The bar that spans the whole duration: new mobile layout, then desktop, then the older mobile one.
const progressBarSelectors = ['.ytChapteredProgressBarHost', '.ytp-progress-list', '.progress-bar-line', '.progress-bar-background']
// Chaptered videos split the bar into per-chapter blocks separated by gaps, so a
// segment has to be drawn piecewise to stay aligned with the time it covers.
const chapterSelectors = ['.ytChapteredProgressBarChapteredPlayerBarChapter', '.ytp-chapter-hover-container']

interface Chapter {
  start: number
  end: number
  left: number
  width: number
}

function getProgressBars() {
  const bars: HTMLElement[] = []
  for (const selector of progressBarSelectors) {
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      if (el.offsetWidth > 0) {
        bars.push(el)
      }
    }
  }
  return bars
}

function getChapters(bar: HTMLElement): Chapter[] {
  let elements: HTMLElement[] = []
  for (const selector of chapterSelectors) {
    elements = Array.from(bar.querySelectorAll<HTMLElement>(selector))
    if (elements.length) {
      break
    }
  }

  if (!elements.length) {
    return [{ start: 0, end: 1, left: 0, width: bar.offsetWidth }]
  }

  // Gaps between chapters make the rendered widths slightly narrower than the
  // time they represent, so take the time span from the inline percentage when
  // YouTube provides it and fall back to the width proportion otherwise.
  const totalWidth = elements.reduce((sum, el) => sum + el.offsetWidth, 0)
  const chapters: Chapter[] = []
  let start = 0
  for (const el of elements) {
    const percent = parseFloat(el.style.width)
    const span = el.style.width.endsWith('%') && Number.isFinite(percent) ? percent / 100 : el.offsetWidth / (totalWidth || 1)
    chapters.push({ start, end: start + span, left: el.offsetLeft, width: el.offsetWidth })
    start += span
  }
  // Absorb rounding drift so the last chapter always reaches the end.
  chapters[chapters.length - 1].end = 1
  return chapters
}

export function clearSkipSegments() {
  for (const el of document.querySelectorAll(`.${overlayClass}`)) {
    ;(el.parentElement as HTMLElement | null)?.removeAttribute('data-nou-sb')
    el.remove()
  }
}

export function renderSkipSegments(videoId: string, segments: Segment[], duration: number) {
  if (!videoId || !duration || !Number.isFinite(duration)) {
    return
  }

  const segmentKey = segments
    .map(({ actionType, category, segment }) => `${actionType}:${category}:${segment[0]}:${segment[1]}`)
    .join(',')
  for (const bar of getProgressBars()) {
    const overlay = bar.querySelector<HTMLElement>(`.${overlayClass}`)
    const chapters = getChapters(bar)
    const chapterKey = chapters
      .map(({ start, end, left, width }) => `${start}:${end}:${left}:${width}`)
      .join(',')
    const key = `${videoId}:${duration}:${segmentKey}:${bar.offsetWidth}:${chapterKey}`
    // YouTube re-renders and resizes its controls, so redraw whenever the
    // overlay went away or its segments/chapter geometry changed.
    if (overlay && bar.dataset.nouSb === key) {
      continue
    }
    overlay?.remove()
    // Chapter offsets are measured against the bar, so it has to be the offset parent.
    if (getComputedStyle(bar).position == 'static') {
      bar.style.position = 'relative'
    }
    bar.append(buildOverlay(segments, duration, chapters))
    bar.dataset.nouSb = key
  }
}

function buildOverlay(segments: Segment[], duration: number, chapters: Chapter[]) {
  const overlay = document.createElement('div')
  overlay.className = overlayClass

  for (const segment of segments) {
    // A `full` segment covers the entire video, so there is nothing to point at.
    if (segment.actionType == 'full') {
      continue
    }
    const background = categoryColors[segment.category] || categoryColors.sponsor
    const start = Math.max(0, Math.min(1, segment.segment[0] / duration))
    const end = Math.max(start, Math.min(1, segment.segment[1] / duration))

    for (const chapter of chapters) {
      const from = Math.max(start, chapter.start)
      const to = Math.min(end, chapter.end)
      // Zero-length categories such as poi_highlight still get a marker.
      if (start == end ? to < from : to <= from) {
        continue
      }
      const span = chapter.end - chapter.start
      if (span <= 0) {
        continue
      }
      // Accumulated chapter spans drift by a rounding error, which would leave a
      // sliver of a segment in the chapter next to the one it really ends in.
      const width = ((to - from) / span) * chapter.width
      if (start != end && width < 0.5) {
        continue
      }
      const el = document.createElement('div')
      el.className = segmentClass
      el.style.left = `${chapter.left + ((from - chapter.start) / span) * chapter.width}px`
      el.style.width = `${Math.max(start == end ? 2 : 1, width)}px`
      el.style.background = background
      overlay.append(el)
    }
  }

  return overlay
}

export async function getSkipSegments(videoId: string) {
  const res = await fetch(`https://sponsor.ajay.app/api/skipSegments?videoID=${videoId}`)
  let segments: Segment[] = []
  if (res.status == 200) {
    segments = (await res.json()) as Segment[]
  }
  return {
    videoId,
    segments,
  }
}
