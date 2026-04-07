import { emit, nouPolicy } from './utils'

const iconDownload = `<svg height="24" viewBox="0 -960 960 960" width="24" style="transform:scale(1.25)"><path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/></svg>`
const iconStar = `<svg height="24" viewBox="0 -960 960 960" width="24" style="transform:scale(1.25)"><path d="m354-287 126-76 126 77-33-144 111-96-146-13-58-136-58 135-146 13 111 97-33 143Zm-61 83.92 49.62-212.54-164.93-142.84 217.23-18.85L480-777.69l85.08 200.38 217.23 18.85-164.93 142.84L667-203.08 480-315.92 293-203.08ZM480-470Z"/></svg>`

const makeWatchButton = ({ icon, label, id }: { icon: string; label: string; id: string }) =>
  nouPolicy.createHTML(/* HTML */ `
    <yt-button-view-model class="ytd-menu-renderer ${id}" style="margin-right: 8px;">
      <button-view-model class="ytSpecButtonViewModelHost style-scope ytd-menu-renderer">
        <button class="yt-spec-button-shape-next yt-spec-button-shape-next--tonal yt-spec-button-shape-next--mono yt-spec-button-shape-next--size-m yt-spec-button-shape-next--icon-leading yt-spec-button-shape-next--enable-backdrop-filter-experiment">
          <div aria-hidden="true" class="yt-spec-button-shape-next__icon">
            <span class="ytIconWrapperHost" style="width: 24px; height: 24px;">
              <span class="yt-icon-shape ytSpecIconShapeHost">
                <div style="width: 24px; height: 24px; display: block; fill: currentcolor;">${icon}</div>
              </span>
            </span>
          </div>
          <div class="yt-spec-button-shape-next__button-text-content">${label}</div>
        </button>
      </button-view-model>
    </yt-button-view-model>
  `)

export function handleWatchPage() {
  if (!window.location.pathname.startsWith('/watch')) return

  const menu = document.querySelector('ytd-watch-metadata ytd-menu-renderer')
  if (!menu) return

  const container = menu.querySelector('#top-level-buttons-computed')
  if (!container) return

  if (window.electron && !menu.querySelector('._nou_watch_download')) {
    const btn = document.createElement('div')
    btn.innerHTML = makeWatchButton({ icon: iconDownload, label: 'Download', id: '_nou_watch_download' })
    const element = btn.firstElementChild as HTMLElement
    element.onclick = () => {
      emit('download', { url: window.location.href })
    }
    container.prepend(element)
  }
}
