import { retry } from 'es-toolkit'
import { emit, nouPolicy } from './utils'

const iconAddQueue = `<svg height="16" viewBox="0 0 24 24" width="16" focusable="false" aria-hidden="true" style="pointer-events: none; display: inherit; width: 100%; height: 100%;"><path d="M21 16h-7v-1h7v1zm0-5H9v1h12v-1zm0-4H3v1h18V7zm-11 8-7-4v8l7-4z"></path></svg>`

const iconStar = `<svg height="24" viewBox="0 -960 960 960" width="24" style="transform:scale(1.25)"><path d="m354-287 126-76 126 77-33-144 111-96-146-13-58-136-58 135-146 13 111 97-33 143Zm-61 83.92 49.62-212.54-164.93-142.84 217.23-18.85L480-777.69l85.08 200.38 217.23 18.85-164.93 142.84L667-203.08 480-315.92 293-203.08ZM480-470Z"/></svg>`

const makeMenuItem = ({ icon, label }: { icon: string; label: string }) =>
  nouPolicy.createHTML(/* HTML */ `
    <button class="menu-item-button">
      <c3-icon fill-icon="false"
        ><span class="yt-icon-shape yt-spec-icon-shape"
          ><div style="width: 100%; height: 100%; display: block; fill: currentcolor;">${icon}</div></span
        ></c3-icon
      ><span class="yt-core-attributed-string" role="text">${label} 🦦</span>
    </button>
  `)
const htmlMenuStar = makeMenuItem({ icon: iconStar, label: 'Star' })
const htmlMenuQueue = makeMenuItem({ icon: iconAddQueue, label: 'Add to queue' })

export function handleMenu() {
  document.addEventListener('click', async (e) => {
    const el = e.target as HTMLElement
    const videoItem = el.closest('ytm-media-item')
    if (videoItem) {
      const menu = await retry(
        async () => {
          const menu = document.querySelector('ytm-menu-service-item-renderer,ytm-menu-navigation-item-renderer')
          if (!menu) {
            throw 'menu not ready'
          }
          return menu
        },
        { retries: 50, delay: 100 },
      )
      const title = videoItem.querySelector('h3')?.innerText
      const url = videoItem.querySelector('a')?.href
      let menuItem = document.createElement('ytm-menu-item')
      menuItem.innerHTML = htmlMenuQueue
      menuItem.onclick = () => {
        if (url) {
          emit('add-queue', { title, url })
        }
      }
      menu.prepend(menuItem)

      menuItem = document.createElement('ytm-menu-item')
      menuItem.innerHTML = htmlMenuStar
      menuItem.onclick = () => {
        if (url) {
          emit('star', { title, url })
        }
      }
      menu.prepend(menuItem)
    }
  })
}
