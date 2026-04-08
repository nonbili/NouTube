import { retry } from 'es-toolkit'
import { iconAddQueue, iconDownload, iconStar } from './icons'
import { emit, nouPolicy } from './utils'

const makeMenuItem = ({ icon, label }: { icon: string; label: string }) =>
  nouPolicy.createHTML(/* HTML */ `
    <button class="menu-item-button" style="display: flex; align-items: center; width: 100%; padding: 0 16px; min-height: 48px; background: none; border: none; font-family: inherit; font-size: 14px; text-align: left; cursor: pointer;">
      <c3-icon fill-icon="false" style="margin-right: 16px; flex-shrink: 0; width: 24px; height: 24px;">
        <span class="yt-icon-shape yt-spec-icon-shape" style="width: 24px; height: 24px; display: block;">
          <div style="width: 24px; height: 24px; display: block; fill: currentcolor;">${icon}</div>
        </span>
      </c3-icon>
      <span class="yt-core-attributed-string" role="text" style="flex: 1; font-size: 14px;">${label} 🦦</span>
    </button>
  `)

const makeListItem = ({ icon, label }: { icon: string; label: string }) =>
  nouPolicy.createHTML(/* HTML */ `
    <div class="yt-list-item-view-model__layout-wrapper yt-list-item-view-model__container yt-list-item-view-model__container--compact yt-list-item-view-model__container--tappable yt-list-item-view-model__container--in-popup">
      <div class="yt-list-item-view-model__main-container" style="display: flex; align-items: center; width: 100%;">
        <div aria-hidden="true" class="yt-list-item-view-model__image-container yt-list-item-view-model__leading" style="flex-shrink: 0;">
          <span
            class="ytIconWrapperHost yt-list-item-view-model__accessory yt-list-item-view-model__image"
            role="img"
            style="width: 24px; height: 24px; display: block;"
          >
            <span class="yt-icon-shape ytSpecIconShapeHost" style="width: 24px; height: 24px; display: block;">
              <div style="width: 24px; height: 24px; display: block; fill: currentcolor;">${icon}</div>
            </span>
          </span>
        </div>
        <div class="yt-list-item-view-model__text-wrapper" style="flex: 1;">
          <div class="yt-list-item-view-model__title-wrapper">
            <span
              class="yt-core-attributed-string yt-list-item-view-model__title yt-core-attributed-string--white-space-pre-wrap"
              role="text"
              style="font-size: 14px; line-height: 2rem;"
            >
              ${label} 🦦
            </span>
          </div>
        </div>
      </div>
    </div>
  `)

const makePaperItem = ({ icon, label }: { icon: string; label: string }) =>
  nouPolicy.createHTML(/* HTML */ `
    <tp-yt-paper-item
      class="style-scope ytd-menu-service-item-renderer"
      role="option"
      style="display: flex; align-items: center; width: 100%; padding: 0 16px; min-height: 40px; cursor: pointer;"
    >
      <yt-icon class="style-scope ytd-menu-service-item-renderer" style="margin-right: 16px; flex-shrink: 0; width: 24px; height: 24px;">
        <span class="yt-icon-shape style-scope yt-icon ytSpecIconShapeHost" style="width: 24px; height: 24px; display: block;">
          <div style="width: 24px; height: 24px; display: block; fill: currentcolor;">${icon}</div>
        </span>
      </yt-icon>
      <yt-formatted-string class="style-scope ytd-menu-service-item-renderer" style="flex: 1; font-size: 14px;">${label} 🦦</yt-formatted-string>
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

      const itemCls = '_nou_menu_'
      menu.querySelectorAll(`.${itemCls}`).forEach((el) => el.remove())
      const item = { icon: iconStar, label: 'Star' }
      switch (menu.tagName.toLowerCase()) {
        case 'yt-list-view-model':
          // desktop home page
          menuItem = document.createElement('yt-list-item-view-model')
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

      {
        const downloadCls = '_nou_download_'
        menu.querySelectorAll(`.${downloadCls}`).forEach((el) => el.remove())
        const downloadItemData = { icon: iconDownload, label: 'Download' }
        let downloadMenuItem: HTMLElement
        switch (menu.tagName.toLowerCase()) {
          case 'yt-list-view-model':
            downloadMenuItem = document.createElement('yt-list-item-view-model')
            downloadMenuItem.classList.add(downloadCls)
            downloadMenuItem.innerHTML = makeListItem(downloadItemData)
            break
          case 'tp-yt-paper-listbox':
            downloadMenuItem = document.createElement('ytd-menu-service-item-renderer')
            downloadMenuItem.classList.add(downloadCls)
            downloadMenuItem.innerHTML = makePaperItem(downloadItemData)
            break
          default:
            downloadMenuItem = document.createElement('ytm-menu-item')
            downloadMenuItem.innerHTML = makeMenuItem(downloadItemData)
        }
        downloadMenuItem.onclick = () => {
          if (url) emit('download', { url })
        }
        menu.prepend(downloadMenuItem)

        if (menu.tagName.toLowerCase() == 'tp-yt-paper-listbox') {
          const label = downloadMenuItem.querySelector('yt-formatted-string')
          if (label?.hasAttribute('is-empty')) {
            label.textContent = downloadItemData.label + ' 🦦'
            label.removeAttribute('is-empty')
          }
          const icon = downloadMenuItem.querySelector('yt-icon')
          if (icon?.hasAttribute('hidden')) {
            icon.innerHTML = nouPolicy.createHTML(/* HTML */ `
              <span class="yt-icon-shape style-scope yt-icon ytSpecIconShapeHost">
                <div style="width: 100%; height: 100%; display: block; fill: currentcolor;">${downloadItemData.icon}</div>
              </span>
            `)
            icon.removeAttribute('hidden')
          }
        }
      }

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
