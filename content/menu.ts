import { retry } from 'es-toolkit'
import { emit, nouPolicy } from './utils'

const iconAddQueue = `<svg height="16" viewBox="0 0 24 24" width="16" focusable="false" aria-hidden="true" style="pointer-events: none; display: inherit; width: 100%; height: 100%;"><path d="M21 16h-7v-1h7v1zm0-5H9v1h12v-1zm0-4H3v1h18V7zm-11 8-7-4v8l7-4z"></path></svg>`

const iconStar = `<svg height="24" viewBox="0 -960 960 960" width="24" style="transform:scale(1.25)"><path d="m354-287 126-76 126 77-33-144 111-96-146-13-58-136-58 135-146 13 111 97-33 143Zm-61 83.92 49.62-212.54-164.93-142.84 217.23-18.85L480-777.69l85.08 200.38 217.23 18.85-164.93 142.84L667-203.08 480-315.92 293-203.08ZM480-470Z"/></svg>`

const makeMenuItem = ({ icon, label }: { icon: string; label: string }) =>
  nouPolicy.createHTML(/* HTML */ `
    <button class="menu-item-button">
      <c3-icon fill-icon="false">
        <span class="yt-icon-shape yt-spec-icon-shape">
          <div style="width: 100%; height: 100%; display: block; fill: currentcolor;">${icon}</div>
        </span>
      </c3-icon>
      <span class="yt-core-attributed-string" role="text">${label} 🦦</span>
    </button>
  `)

const makeListItem = ({ icon, label }: { icon: string; label: string }) =>
  nouPolicy.createHTML(/* HTML */ `
    <div
      class="yt-list-item-view-model__label yt-list-item-view-model__container yt-list-item-view-model__container--compact yt-list-item-view-model__container--tappable yt-list-item-view-model__container--in-popup"
    >
      <div aria-hidden="true" class="yt-list-item-view-model__image-container yt-list-item-view-model__leading">
        <span
          class="ytIconWrapperHost yt-list-item-view-model__accessory yt-list-item-view-model__image"
          role="img"
          aria-label=""
          aria-hidden="true"
          style=""
        >
          <span class="yt-icon-shape ytSpecIconShapeHost">
            <div style="width: 100%; height: 100%; display: block; fill: currentcolor;">${icon}</div>
          </span>
        </span>
      </div>
      <div class="yt-list-item-view-model__text-wrapper">
        <div class="yt-list-item-view-model__title-wrapper">
          <span
            class="yt-core-attributed-string yt-list-item-view-model__title yt-core-attributed-string--white-space-pre-wrap"
            role="text"
          >
            ${label} 🦦
          </span>
        </div>
      </div>
    </div>
  `)

const makePaperItem = ({ icon, label }: { icon: string; label: string }) =>
  nouPolicy.createHTML(/* HTML */ `
    <tp-yt-paper-item
      class="style-scope ytd-menu-service-item-renderer"
      style-target="host"
      role="option"
      tabindex="0"
      aria-disabled="false"
    >
      <yt-icon class="style-scope ytd-menu-service-item-renderer">
        <span class="yt-icon-shape style-scope yt-icon ytSpecIconShapeHost">
          <div style="width: 100%; height: 100%; display: block; fill: currentcolor;">${icon}</div>
        </span>
      </yt-icon>
      <yt-formatted-string class="style-scope ytd-menu-service-item-renderer">${label}</yt-formatted-string>
      <ytd-badge-supported-renderer class="style-scope ytd-menu-service-item-renderer" system-icons="" hidden="">
        <dom-repeat id="repeat" as="badge" class="style-scope ytd-badge-supported-renderer">
          <template is="dom-repeat"></template>
        </dom-repeat>
      </ytd-badge-supported-renderer>
    </tp-yt-paper-item>
  `)

const htmlMenuStar = makeMenuItem({ icon: iconStar, label: 'Star' })
const htmlMenuQueue = makeMenuItem({ icon: iconAddQueue, label: 'Add to queue' })

export function handleMenu() {
  document.addEventListener('click', async (e) => {
    const el = e.target as HTMLElement
    const videoItem = el.closest(
      'ytm-media-item,ytm-compact-video-renderer,yt-lockup-metadata-view-model,ytd-video-renderer,ytd-grid-video-renderer',
    )
    if (videoItem) {
      const menu = await retry(
        async () => {
          const menu1 = document.querySelector(
            'ytm-menu-service-item-renderer,ytm-menu-navigation-item-renderer,yt-list-view-model',
          ) as HTMLElement
          const menu2 = document.querySelector('tp-yt-paper-listbox') as HTMLElement
          if (menu1?.offsetHeight) {
            return menu1
          }
          if (menu2?.offsetHeight) {
            return menu2
          }
          throw 'menu not ready'
        },
        { retries: 50, delay: 100 },
      )
      const title =
        videoItem.querySelector('h3')?.textContent?.trim() || videoItem.querySelector('h4')?.textContent?.trim()
      const url = videoItem.querySelector('a')?.href
      let menuItem: HTMLElement

      if (window.NouTubeI) {
        menuItem = document.createElement('ytm-menu-item')
        menuItem.innerHTML = htmlMenuQueue
        menuItem.onclick = () => {
          if (url) {
            emit('add-queue', { title, url })
          }
          menuItem.remove()
        }
        menu.prepend(menuItem)
      }

      const itemCls = '_inks_menu_'
      menu.querySelectorAll(`.${itemCls}`).forEach((el) => el.remove())
      const item = { icon: iconStar, label: 'Star' }
      switch (menu.tagName.toLowerCase()) {
        case 'yt-list-view-model':
          // desktop home page
          menuItem = document.createElement('ytm-list-item-view-model')
          menuItem.classList.add(itemCls)
          menuItem.innerHTML = makeListItem(item)
          break
        case 'tp-yt-paper-listbox':
          // desktop channel and search page
          menuItem = document.createElement('ytd-menu-service-item-renderer')
          menuItem.classList.add(itemCls)
          menuItem.innerHTML = makePaperItem(item)
          break
        default:
          // mobile
          menuItem = document.createElement('ytm-menu-item')
          menuItem.innerHTML = makeMenuItem(item)
      }
      menuItem.onclick = () => {
        if (url) {
          emit('star', { title, url })
        }
      }
      menu.prepend(menuItem)

      if (menu.tagName.toLowerCase() == 'tp-yt-paper-listbox') {
        const label = menuItem.querySelector('yt-formatted-string')
        if (label?.hasAttribute('is-empty')) {
          label.textContent = item.label + ' 🦦'
          label.removeAttribute('is-empty')
        }
        const icon = menuItem.querySelector('yt-icon')
        if (icon?.hasAttribute('hidden')) {
          icon.innerHTML = nouPolicy.createHTML(/* HTML */ `
            <span class="yt-icon-shape style-scope yt-icon ytSpecIconShapeHost">
              <div style="width: 100%; height: 100%; display: block; fill: currentcolor;">${item.icon}</div>
            </span>
          `)
          icon.removeAttribute('hidden')
        }
      }
    }
  })
}
