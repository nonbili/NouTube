import { iconDownload } from './icons'
import { emit, nouPolicy } from './utils'

const makeDesktopWatchButton = ({ icon, label, id }: { icon: string; label: string; id: string }) =>
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

const makeMobileWatchButton = ({ icon, label, id }: { icon: string; label: string; id: string }) =>
  nouPolicy.createHTML(/* HTML */ `
    <button-view-model class="ytSpecButtonViewModelHost slim_video_action_bar_renderer_button ${id}">
      <button
        class="yt-spec-button-shape-next yt-spec-button-shape-next--tonal yt-spec-button-shape-next--mono yt-spec-button-shape-next--size-m yt-spec-button-shape-next--icon-leading"
        aria-label="${label}"
        aria-disabled="false"
      >
        <div aria-hidden="true" class="yt-spec-button-shape-next__icon">
          <c3-icon style="width: 24px; height: 24px;" fill-icon="false">
            <span class="yt-icon-shape ytSpecIconShapeHost">
              <div style="width: 100%; height: 100%; display: block; fill: currentcolor;">${icon}</div>
            </span>
          </c3-icon>
        </div>
        <div class="yt-spec-button-shape-next__button-text-content">${label}</div>
        <yt-touch-feedback-shape
          aria-hidden="true"
          class="ytSpecTouchFeedbackShapeHost ytSpecTouchFeedbackShapeTouchResponse"
        >
          <div class="ytSpecTouchFeedbackShapeStroke"></div>
          <div class="ytSpecTouchFeedbackShapeFill"></div>
        </yt-touch-feedback-shape>
      </button>
    </button-view-model>
  `)

export function handleWatchPage() {
  if (!window.location.pathname.startsWith('/watch')) return

  const desktopMenu = document.querySelector('ytd-watch-metadata ytd-menu-renderer')
  const desktopContainer = desktopMenu?.querySelector('#top-level-buttons-computed')
  if (desktopMenu && desktopContainer && !desktopMenu.querySelector('._nou_watch_download')) {
    const btn = document.createElement('div')
    btn.innerHTML = makeDesktopWatchButton({ icon: iconDownload, label: 'Download', id: '_nou_watch_download' })
    const element = btn.firstElementChild as HTMLElement
    element.onclick = () => {
      emit('download', { url: window.location.href })
    }
    desktopContainer.prepend(element)
    return
  }

  const mobileContainer = document.querySelector('.slim-video-action-bar-actions')
  if (mobileContainer && !mobileContainer.querySelector('._nou_watch_download')) {
    const btn = document.createElement('div')
    btn.innerHTML = makeMobileWatchButton({ icon: iconDownload, label: 'Download', id: '_nou_watch_download' })
    const element = btn.firstElementChild as HTMLElement
    element.onclick = () => {
      emit('download', { url: window.location.href })
    }
    mobileContainer.prepend(element)
  }
}
