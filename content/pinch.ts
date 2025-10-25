export function pinchToZoom() {
  const viewport = document.querySelector('meta[name=viewport]')
  if (viewport) {
    const viewportContent = viewport.getAttribute('content')
    if (viewportContent) {
      let contents = viewportContent.split(',')
      let changed = false
      ;['maximum-scale', 'user-scalable'].forEach((key) => {
        if (viewportContent.includes(key)) {
          contents = contents.filter((x) => !x.includes(key))
          changed = true
        }
      })
      if (changed) {
        viewport.setAttribute('content', contents.join(','))
      }
    }
  }
}
