import http from 'http'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import WebSocket from 'ws'

const ROOT = path.resolve(__dirname, '..')
const DESKTOP_DIR = path.join(ROOT, 'desktop')
const OUT_DIRS = [
  path.join(ROOT, 'mstore'),
  path.join(ROOT, 'mstore/screenshots'),
  path.join(ROOT, 'metadata/mstore'),
  path.join(ROOT, 'metadata/mstore/screenshots'),
]

OUT_DIRS.forEach((dir) => fs.mkdirSync(dir, { recursive: true }))

const mockJs = `
window.electron = {
  ipcRenderer: {
    on: () => {},
    send: () => {},
    invoke: async (channel, name, ...args) => {
      if (name === 'consumePendingDeeplinks') return []
      if (name === 'getDiscordStatus') return false
      return null
    }
  },
  process: {
    platform: 'win32',
    arch: 'x64',
    versions: { chrome: '130.0.0', electron: '43.4.1', node: '20.0.0' },
    env: {}
  }
};

window.renderMockPlayer = (opts) => {
  let player = document.getElementById('mock-main-player');
  const webviews = Array.from(document.querySelectorAll('webview'));
  const activeWebview = webviews.find(w => w.parentElement && getComputedStyle(w.parentElement).opacity === '1') || webviews[0];
  const container = activeWebview?.parentElement;
  if (!player) {
    player = document.createElement('div');
    player.id = 'mock-main-player';
  }
  if (container) {
    if (player.parentElement !== container) container.appendChild(player);
    player.style.left = (opts.offsetLeft || 0) + 'px';
    player.style.zIndex = '50';
  } else {
    const root = document.getElementById('root');
    if (root) {
      if (root.firstElementChild) {
        root.firstElementChild.style.position = 'relative';
        root.firstElementChild.style.zIndex = '1';
      }
      if (player.parentElement !== root) root.prepend(player);
    } else if (player.parentElement !== document.body) {
      document.body.prepend(player);
    }
    player.style.left = (56 + (opts.offsetLeft || 0)) + 'px';
    player.style.zIndex = '0';
  }
  player.style.position = 'absolute';
  player.style.top = '0';
  player.style.right = '0';
  player.style.bottom = '0';
  player.style.overflow = 'hidden';
  player.style.backgroundColor = '#05070a';

  player.innerHTML = \`
    <div style="position: absolute; inset: 0; background-image: url('\${opts.image}'); background-size: cover; background-position: center;">
      <div style="position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 65%, rgba(0,0,0,0.85) 100%);"></div>
    </div>

    <div style="position: absolute; top: 20px; right: 28px; display: flex; align-items: center; gap: 10px; z-index: 2;">
      \${(opts.badges || []).map(b => \`
        <span style="background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.15); color: #e2e8f0; padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: system-ui, sans-serif;">\${b}</span>
      \`).join('')}
    </div>

    <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 20px 36px 28px; background: linear-gradient(0deg, rgba(9, 9, 11, 0.95) 0%, rgba(9, 9, 11, 0.7) 60%, transparent 100%); z-index: 2; font-family: system-ui, -apple-system, sans-serif; color: #fff;">
      <div style="width: 100%; height: 6px; background: rgba(255, 255, 255, 0.2); border-radius: 3px; margin-bottom: 16px; position: relative; cursor: pointer;">
        <div style="position: absolute; left: 0; top: 0; bottom: 0; width: \${Math.round((opts.progress || 0.5) * 100)}%; background: #3b82f6; border-radius: 3px;">
          <div style="position: absolute; right: -6px; top: -5px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 0 8px rgba(0,0,0,0.5);"></div>
        </div>
      </div>

      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 18px;">
          <div style="width: 40px; height: 40px; border-radius: 50%; background: #3b82f6; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
          </div>
          <span style="font-size: 14px; color: #cbd5e1; font-variant-numeric: tabular-nums; font-weight: 500;">\${opts.time}</span>
          <div style="margin-left: 10px;">
            <div style="font-size: 17px; font-weight: 600; color: #f8fafc; letter-spacing: 0.1px;">\${opts.title}</div>
            <div style="font-size: 13px; color: #94a3b8; margin-top: 2px;">\${opts.channel}</div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 18px; color: #cbd5e1;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z"/></svg>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
        </div>
      </div>
    </div>
  \`;
};

window.renderMockPage = (opts) => {
  let page = document.getElementById('mock-main-player');
  const webviews = Array.from(document.querySelectorAll('webview'));
  const activeWebview = webviews.find(w => w.parentElement && getComputedStyle(w.parentElement).opacity === '1') || webviews[0];
  const container = activeWebview?.parentElement;
  if (!page) {
    page = document.createElement('div');
    page.id = 'mock-main-player';
  }
  if (container) {
    if (page.parentElement !== container) container.appendChild(page);
    page.style.left = '0';
    page.style.zIndex = '50';
  } else {
    document.body.prepend(page);
    page.style.left = '0';
    page.style.zIndex = '0';
  }
  page.style.position = 'absolute';
  page.style.top = '0';
  page.style.right = '0';
  page.style.bottom = '0';
  page.style.overflow = 'hidden';

  if (opts.mode === 'yt-channel') {
    page.style.backgroundColor = '#ffffff';
    page.style.color = '#0f0f0f';
    page.innerHTML = \`
      <div style="font-family: Roboto, Arial, sans-serif; height: 100%; display: flex; flex-direction: column;">
        <!-- Top Search Header (logo on far left is covered by drawer) -->
        <div style="height: 56px; display: flex; align-items: center; justify-content: flex-end; padding: 0 24px 0 \${opts.leftPad ?? 448}px; gap: 12px;">
          <div style="display: flex; align-items: center; flex: 1; max-width: 340px; height: 38px; border: 1px solid #d4d4d8; border-radius: 20px; overflow: hidden; background: #fff;">
            <div style="flex: 1; padding: 0 16px; font-size: 14px; color: #71717a; display: flex; align-items: center; justify-content: space-between;">
              <span>\${opts.searchQuery || ''}</span>
              <span style="font-size: 18px; color: #52525b;">✕</span>
            </div>
            <div style="width: 52px; height: 100%; background: #f4f4f5; border-left: 1px solid #d4d4d8; display: flex; align-items: center; justify-content: center;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f0f0f" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            </div>
          </div>
          <div style="width: 38px; height: 38px; border-radius: 50%; background: #f4f4f5; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#0f0f0f"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>
          </div>
          <div style="padding: 8px; color: #0f0f0f;">⋮</div>
        </div>

        <!-- Channel Content -->
        <div style="padding: 0 28px 0 \${opts.leftPad ?? 448}px;">
          <div style="height: 112px; border-radius: 12px; background-image: url('\${opts.banner}'); background-size: cover; background-position: center;"></div>
          <div style="margin-top: 18px;">
            <div style="font-size: 22px; font-weight: 700; color: #0f0f0f;">\${opts.channelTitle}</div>
            <div style="font-size: 13px; color: #606060; margin-top: 4px;">\${opts.channelMeta}</div>
            <div style="font-size: 13px; color: #606060; margin-top: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">\${opts.channelDesc} <strong style="color: #0f0f0f;">...more</strong></div>
          </div>
          <div style="display: flex; align-items: center; gap: 24px; margin-top: 18px; border-bottom: 1px solid #e4e4e7; padding-bottom: 10px; font-size: 14px; font-weight: 500; color: #606060;">
            <span style="color: #0f0f0f; border-bottom: 2px solid #0f0f0f; padding-bottom: 10px; margin-bottom: -11px;">Videos</span>
            <span>Playlists</span>
            <span>Posts</span>
            <span>Store</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#606060" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          </div>
          <div style="margin-top: 16px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px;">
            \${(opts.videos || []).map(v => \`
              <div>
                <div style="aspect-ratio: 16/9; border-radius: 10px; background-image: url('\${v.thumb}'); background-size: cover; background-position: center; position: relative;">
                  <span style="position: absolute; bottom: 6px; right: 6px; background: rgba(0,0,0,0.8); color: #fff; font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 4px;">\${v.dur}</span>
                </div>
                <div style="font-size: 13px; font-weight: 600; color: #0f0f0f; margin-top: 6px; line-height: 1.3;">\${v.title}</div>
                <div style="font-size: 11px; color: #606060; margin-top: 2px;">\${v.meta}</div>
              </div>
            \`).join('')}
          </div>
        </div>
      </div>
    \`;
  } else if (opts.mode === 'yt-music') {
    page.style.backgroundColor = '#030303';
    page.style.color = '#ffffff';
    page.innerHTML = \`
      <div style="font-family: Roboto, Arial, sans-serif; height: 100%; display: flex; flex-direction: column; background: radial-gradient(circle at 75% 15%, rgba(56, 189, 248, 0.14), transparent 55%), #030303;">
        <!-- Top Search Header (YT Music logo on far left is covered by drawer) -->
        <div style="height: 56px; display: flex; align-items: center; justify-content: flex-end; padding: 0 28px 0 \${opts.leftPad ?? 448}px; gap: 16px; border-bottom: 1px solid rgba(255,255,255,0.08);">
          <div style="flex: 1; height: 36px; border-radius: 8px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.14); display: flex; align-items: center; padding: 0 14px; gap: 10px; color: #a1a1aa; font-size: 14px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <span>Search songs, albums, artists</span>
          </div>
          <div style="width: 28px; height: 28px; border-radius: 50%; background: #3b82f6; color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center;">N</div>
        </div>

        <div style="padding: 20px 28px 0 \${opts.leftPad ?? 448}px;">
          <div style="display: flex; gap: 8px; flex-wrap: nowrap; overflow: hidden;">
            \${['Focus', 'Relax', 'Energize', 'Commute', 'Feel good'].map((c, i) => \`
              <span style="padding: 6px 12px; border-radius: 8px; font-size: 13px; font-weight: 500; background: \${i === 0 ? '#ffffff' : 'rgba(255,255,255,0.1)'}; color: \${i === 0 ? '#030303' : '#ffffff'}; white-space: nowrap;">\${c}</span>
            \`).join('')}
          </div>

          <div style="font-size: 19px; font-weight: 700; margin-top: 22px; margin-bottom: 14px;">Listen again</div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
            \${(opts.albums || []).map(a => \`
              <div>
                <div style="aspect-ratio: 16/10; border-radius: 8px; background-image: url('\${a.thumb}'); background-size: cover; background-position: center; position: relative;">
                  <div style="position: absolute; bottom: 8px; right: 8px; width: 32px; height: 32px; border-radius: 50%; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                </div>
                <div style="font-size: 13px; font-weight: 600; color: #fff; margin-top: 6px;">\${a.title}</div>
                <div style="font-size: 12px; color: #a1a1aa; margin-top: 2px;">\${a.artist}</div>
              </div>
            \`).join('')}
          </div>
        </div>
      </div>
    \`;
  } else if (opts.mode === 'yt-watch') {
    page.style.backgroundColor = '#0f0f0f';
    page.style.color = '#ffffff';
    page.innerHTML = \`
      <div style="font-family: Roboto, Arial, sans-serif; height: 100%; display: flex; flex-direction: column;">
        <div style="height: 52px; display: flex; align-items: center; justify-content: flex-end; padding: 0 24px 0 \${opts.leftPad ?? 448}px; gap: 12px;">
          <div style="flex: 1; height: 34px; border: 1px solid #303030; border-radius: 18px; background: #121212; display: flex; align-items: center; padding: 0 14px; justify-content: space-between; color: #888; font-size: 13px;">
            <span>Search</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          </div>
        </div>
        <div style="padding: 4px 24px 0 \${opts.leftPad ?? 448}px;">
          <div style="aspect-ratio: 16/9; border-radius: 12px; background-image: url('\${opts.image}'); background-size: cover; background-position: center; position: relative; overflow: hidden;">
            <div style="position: absolute; inset: 0; background: linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 40%);"></div>
            <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 12px 16px;">
              <div style="height: 4px; background: rgba(255,255,255,0.25); border-radius: 2px; margin-bottom: 10px;">
                <div style="width: \${Math.round((opts.progress || 0.5) * 100)}%; height: 100%; background: #ff0033; border-radius: 2px;"></div>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #e4e4e7;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
                  <span>\${opts.time}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="background: rgba(34,197,94,0.25); color: #4ade80; padding: 2px 8px; border-radius: 4px; font-weight: 600;">Ad-Free</span>
                  <span>HD</span>
                </div>
              </div>
            </div>
          </div>
          <div style="font-size: 16px; font-weight: 700; margin-top: 12px; color: #f1f1f1;">\${opts.title}</div>
          <div style="font-size: 12px; color: #aaaaaa; margin-top: 4px;">\${opts.channel}</div>
        </div>
      </div>
    \`;
  }
};
`

let rawHtml = fs.readFileSync(path.join(DESKTOP_DIR, 'out/renderer/index.html'), 'utf8')
rawHtml = rawHtml.replace(/Content-Security-Policy/g, 'X-CSP-Disabled')
rawHtml = rawHtml.replace(
  '<script type="module"',
  '<script src="/mock-electron.js"></script><script type="module"',
)
rawHtml = rawHtml.replace(
  '<div id="root"></div>',
  `<style>
    [class*="bg-gray-600"], [class*="bg-zinc-300"] {
      background-color: rgba(0, 0, 0, 0.25) !important;
    }
    [class*="w-[30rem]"], [class*="max-w-[42vw]"], [class*="max-w-[80vw]"] {
      box-shadow: 12px 0 36px rgba(0, 0, 0, 0.65) !important;
      border-right: 1px solid rgba(255, 255, 255, 0.12) !important;
    }
  </style><div id="root" style="height: 100vh; overflow: hidden; position: relative;"></div>`,
)

const server = http.createServer((req, res) => {
  const url = req.url || '/'
  if (url === '/' || url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(rawHtml)
  } else if (url === '/mock-electron.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript' })
    res.end(mockJs)
  } else if (url === '/app-icon.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' })
    res.end(fs.readFileSync(path.join(ROOT, 'assets/images/icon.png')))
  } else if (url.startsWith('/demo-assets/')) {
    const filename = url.replace('/demo-assets/', '')
    let filePath = path.join(ROOT, 'metadata/en-US/screenshots/demo-assets', filename)
    if (!fs.existsSync(filePath)) {
      filePath = path.join('/tmp/demo-assets', filename)
    }
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath)
      const mime = ext === '.png' ? 'image/png' : 'image/jpeg'
      res.writeHead(200, { 'Content-Type': mime })
      res.end(fs.readFileSync(filePath))
      return
    }
    res.writeHead(404)
    res.end()
  } else {
    const file = path.join(DESKTOP_DIR, 'out/renderer', url)
    if (fs.existsSync(file)) {
      if (file.endsWith('.js')) res.writeHead(200, { 'Content-Type': 'application/javascript' })
      else if (file.endsWith('.css')) res.writeHead(200, { 'Content-Type': 'text/css' })
      else if (file.endsWith('.ttf')) res.writeHead(200, { 'Content-Type': 'font/ttf' })
      else res.writeHead(200)
      res.end(fs.readFileSync(file))
    } else {
      res.writeHead(404)
      res.end()
    }
  }
})

interface ScreenshotTask {
  name: string
  num: number
  setup: string
  action?: string
  waitMs?: number
}

const TASKS: ScreenshotTask[] = [
  {
    name: '01-feeds',
    num: 1,
    setup: `
      const { ui$, settings$, tabs$, bookmarks$, feeds$ } = window.__noutube;
      settings$.theme.set('dark');
      tabs$.tabs.set([
        { id: '1', title: 'Personal Feeds', url: 'noutube://feeds' },
        { id: '2', title: 'Deep Space Galaxy Survey', url: 'https://images.nasa.gov/details/carina_nebula' },
        { id: '3', title: 'Local Library', url: 'noutube://library' }
      ]);
      tabs$.activeTabIndex.set(0);

      bookmarks$.bookmarks.set([
        {
          id: 'ch-nasa',
          url: 'https://www.youtube.com/@NASA',
          title: 'NASA',
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-01'),
          json: { id: 'UCvWlpGgZtLq2XlXm-J5F', thumbnail: '/demo-assets/nasa.png' }
        },
        {
          id: 'ch-blender',
          url: 'https://www.youtube.com/@Blender',
          title: 'Blender Foundation',
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-01'),
          json: { id: 'UCbX3G6j22k24n49w6dJ8Q', thumbnail: '/demo-assets/blender.png' }
        },
        {
          id: 'ch-veritasium',
          url: 'https://www.youtube.com/@veritasium',
          title: 'Veritasium',
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-01'),
          json: { id: 'UCHnyfMqiRRG1u-2MsSQLbXA', thumbnail: '/demo-assets/veritasium.png' }
        },
        {
          id: 'ch-mit',
          url: 'https://www.youtube.com/@mitocw',
          title: 'MIT OpenCourseWare',
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-01'),
          json: { id: 'UCEBb1b_L6zDS3xTUrIALZOw', thumbnail: '/demo-assets/mit.png' }
        },
        {
          id: 'ch-kurz',
          url: 'https://www.youtube.com/@kurzgesagt',
          title: 'Kurzgesagt – In a Nutshell',
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-01'),
          json: { id: 'UCsXVk37bltHxD1rDPwtNM8Q', thumbnail: '/demo-assets/kurzgesagt.png' }
        }
      ]);

      feeds$.feeds.set([
        { id: 'UCvWlpGgZtLq2XlXm-J5F', fetchedAt: new Date() },
        { id: 'UCbX3G6j22k24n49w6dJ8Q', fetchedAt: new Date() },
        { id: 'UCHnyfMqiRRG1u-2MsSQLbXA', fetchedAt: new Date() },
        { id: 'UCEBb1b_L6zDS3xTUrIALZOw', fetchedAt: new Date() },
        { id: 'UCsXVk37bltHxD1rDPwtNM8Q', fetchedAt: new Date() }
      ]);

      feeds$.bookmarks.set([
        {
          id: 'v-1',
          url: 'https://www.youtube.com/watch?v=moon',
          title: 'Tour of the Moon in 4K (Redux)',
          created_at: new Date(Date.now() - 4 * 3600 * 1000),
          updated_at: new Date(Date.now() - 4 * 3600 * 1000),
          json: { id: 'UCvWlpGgZtLq2XlXm-J5F', thumbnail: '/demo-assets/moon.jpg' }
        },
        {
          id: 'v-2',
          url: 'https://www.youtube.com/watch?v=blender',
          title: 'Blender 4.3 Feature Reel: EEVEE Next & Geometry Nodes',
          created_at: new Date(Date.now() - 18 * 3600 * 1000),
          updated_at: new Date(Date.now() - 18 * 3600 * 1000),
          json: { id: 'UCbX3G6j22k24n49w6dJ8Q', thumbnail: '/demo-assets/blender.jpg' }
        },
        {
          id: 'v-3',
          url: 'https://www.youtube.com/watch?v=quantum',
          title: 'The Real Story Behind the Quantum Revolution',
          created_at: new Date(Date.now() - 24 * 3600 * 1000),
          updated_at: new Date(Date.now() - 24 * 3600 * 1000),
          json: { id: 'UCHnyfMqiRRG1u-2MsSQLbXA', thumbnail: '/demo-assets/quantum.jpg' }
        },
        {
          id: 'v-4',
          url: 'https://www.youtube.com/watch?v=sun',
          title: 'Thermonuclear Art: The Sun in Ultra HD',
          created_at: new Date(Date.now() - 48 * 3600 * 1000),
          updated_at: new Date(Date.now() - 48 * 3600 * 1000),
          json: { id: 'UCvWlpGgZtLq2XlXm-J5F', thumbnail: '/demo-assets/sun.jpg' }
        },
        {
          id: 'v-5',
          url: 'https://www.youtube.com/watch?v=galaxy',
          title: 'Deep Space Galaxy Survey: Webb Telescope Observations',
          created_at: new Date(Date.now() - 72 * 3600 * 1000),
          updated_at: new Date(Date.now() - 72 * 3600 * 1000),
          json: { id: 'UCvWlpGgZtLq2XlXm-J5F', thumbnail: '/demo-assets/galaxy.jpg' }
        },
        {
          id: 'v-6',
          url: 'https://www.youtube.com/watch?v=earth',
          title: 'Blue Marble: High Definition Earth from Space',
          created_at: new Date(Date.now() - 96 * 3600 * 1000),
          updated_at: new Date(Date.now() - 96 * 3600 * 1000),
          json: { id: 'UCvWlpGgZtLq2XlXm-J5F', thumbnail: '/demo-assets/earth.jpg' }
        },
        {
          id: 'v-7',
          url: 'https://www.youtube.com/watch?v=mars',
          title: 'Curiosity & Perseverance: Exploring Mars Craters',
          created_at: new Date(Date.now() - 120 * 3600 * 1000),
          updated_at: new Date(Date.now() - 120 * 3600 * 1000),
          json: { id: 'UCvWlpGgZtLq2XlXm-J5F', thumbnail: '/demo-assets/mars.jpg' }
        },
        {
          id: 'v-8',
          url: 'https://www.youtube.com/watch?v=jupiter',
          title: 'Juno: Close Encounters with the Great Red Spot',
          created_at: new Date(Date.now() - 144 * 3600 * 1000),
          updated_at: new Date(Date.now() - 144 * 3600 * 1000),
          json: { id: 'UCvWlpGgZtLq2XlXm-J5F', thumbnail: '/demo-assets/jupiter.jpg' }
        },
        {
          id: 'v-9',
          url: 'https://www.youtube.com/watch?v=aurora',
          title: 'Aurora Borealis Observed from Orbit',
          created_at: new Date(Date.now() - 168 * 3600 * 1000),
          updated_at: new Date(Date.now() - 168 * 3600 * 1000),
          json: { id: 'UCEBb1b_L6zDS3xTUrIALZOw', thumbnail: '/demo-assets/aurora.jpg' }
        }
      ]);

      ui$.feedModalOpen.set(true);
    `,
    action: `
      window.renderMockPage({
        mode: 'yt-channel',
        leftPad: 448,
        searchQuery: '',
        banner: '/demo-assets/galaxy.jpg',
        channelTitle: 'NASA Goddard',
        channelMeta: '@NASA • 12.4M subscribers • 4.2K videos',
        channelDesc: 'Exploring the cosmos, Earth science, and deep space discoveries from NASA.',
        videos: [
          { thumb: '/demo-assets/moon.jpg', dur: '5:00', title: 'Tour of the Moon in 4K (Redux)', meta: '1.8M views • 2 weeks ago' },
          { thumb: '/demo-assets/sun.jpg', dur: '30:00', title: 'Thermonuclear Art: The Sun in Ultra HD', meta: '3.2M views • 1 month ago' },
          { thumb: '/demo-assets/mars.jpg', dur: '12:14', title: 'Curiosity & Perseverance: Exploring Mars', meta: '940K views • 2 months ago' },
          { thumb: '/demo-assets/earth.jpg', dur: '14:00', title: 'Blue Marble: Earth from Space', meta: '2.1M views • 3 months ago' }
        ]
      });
    `,
    waitMs: 800,
  },
  {
    name: '02-distractions',
    num: 2,
    setup: `
      const { ui$, settings$, tabs$, userStyles$ } = window.__noutube;
      settings$.theme.set('dark');
      settings$.hideShorts.set(true);
      settings$.hideShortsInNavbar.set(true);
      settings$.hideMixPlaylist.set(true);
      settings$.blockAds.set(true);
      settings$.sponsorBlock.set(true);
      settings$.disableAutoplay.set(true);
      if (userStyles$?.builtins) {
        if (userStyles$.builtins['hide-home-feed']) userStyles$.builtins['hide-home-feed'].enabled.set(true);
        if (userStyles$.builtins['hide-related-videos']) userStyles$.builtins['hide-related-videos'].enabled.set(true);
        if (userStyles$.builtins['hide-end-screens']) userStyles$.builtins['hide-end-screens'].enabled.set(true);
        if (userStyles$.builtins['hide-community-posts']) userStyles$.builtins['hide-community-posts'].enabled.set(true);
      }
      tabs$.tabs.set([
        { id: '1', title: 'Distraction Controls', url: 'noutube://settings/preferences' },
        { id: '2', title: 'The Sun in Ultra HD', url: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e001435' }
      ]);
      tabs$.activeTabIndex.set(0);

      ui$.settingsModalOpen.set(true);
    `,
    action: `
      const el = Array.from(document.querySelectorAll('*')).find(e => e.innerText === 'Preferences');
      if (el) el.click();
      window.renderMockPage({
        mode: 'yt-watch',
        leftPad: 24,
        title: 'Thermonuclear Art: The Sun in Ultra HD',
        channel: 'NASA Solar Dynamics Observatory • 3.2M views',
        time: '12:45 / 30:00',
        image: '/demo-assets/sun.jpg',
        progress: 0.42
      });
    `,
    waitMs: 800,
  },
  {
    name: '03-blocklist',
    num: 3,
    setup: `
      const { ui$, settings$, tabs$, blocklist$ } = window.__noutube;
      settings$.theme.set('dark');
      blocklist$.channels.set([
        { id: 'c1', value: 'Sensational Vlogs Daily', enabled: true },
        { id: 'c2', value: 'Clickbait Central', enabled: true },
        { id: 'c3', value: 'Celebrity Gossip TV', enabled: true },
        { id: 'c4', value: 'Pranks & Drama Online', enabled: true },
        { id: 'c5', value: 'Outrage News 24/7', enabled: true },
        { id: 'c6', value: 'Rumor Mill Live', enabled: true }
      ]);
      blocklist$.keywords.set([
        { id: 'k1', value: 'clickbait', enabled: true },
        { id: 'k2', value: 'spoilers', enabled: true },
        { id: 'k3', value: 'prank', enabled: true },
        { id: 'k4', value: 'reaction', enabled: true },
        { id: 'k5', value: 'drama', enabled: true },
        { id: 'k6', value: 'shocking', enabled: true },
        { id: 'k7', value: 'cringe', enabled: true },
        { id: 'k8', value: 'leaked', enabled: true },
        { id: 'k9', value: 'ragebait', enabled: true }
      ]);
      tabs$.tabs.set([
        { id: '1', title: 'Content Filters & Blocklist', url: 'noutube://settings/blocklist' },
        { id: '2', title: 'Earth from Space', url: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e001386' }
      ]);
      tabs$.activeTabIndex.set(0);

      ui$.settingsModalOpen.set(true);
    `,
    action: `
      const el = Array.from(document.querySelectorAll('div, span, p')).find(e => e.innerText === 'Blocklist');
      if (el) el.click();
      window.renderMockPage({
        mode: 'yt-channel',
        leftPad: 24,
        searchQuery: '',
        banner: '/demo-assets/earth.jpg',
        channelTitle: 'MIT OpenCourseWare',
        channelMeta: '@mitocw • 5.6M subscribers • 6.8K videos',
        channelDesc: 'Free, open educational resources from MIT for learners and educators worldwide.',
        videos: [
          { thumb: '/demo-assets/quantum.jpg', dur: '18:45', title: 'Quantum Mechanics & Photon Detectors', meta: '620K views • 1 week ago' },
          { thumb: '/demo-assets/galaxy.jpg', dur: '15:00', title: 'Astrophysics: Cosmic Dawn Survey', meta: '410K views • 3 weeks ago' },
          { thumb: '/demo-assets/aurora.jpg', dur: '9:30', title: 'Upper Atmosphere Aurora Physics', meta: '280K views • 1 month ago' },
          { thumb: '/demo-assets/jupiter.jpg', dur: '11:20', title: 'Planetary Atmospheres & Fluid Dynamics', meta: '350K views • 2 months ago' }
        ]
      });
    `,
    waitMs: 800,
  },
  {
    name: '04-library',
    num: 4,
    setup: `
      const { ui$, settings$, tabs$, folders$, bookmarks$ } = window.__noutube;
      settings$.theme.set('dark');
      tabs$.tabs.set([
        { id: '1', title: 'Local Library', url: 'noutube://library' },
        { id: '2', title: 'Blender 4.3 Feature Reel', url: 'https://peach.blender.org' }
      ]);
      tabs$.activeTabIndex.set(0);

      folders$.folders.set([
        { id: 'f1', name: 'Space & Astronomy', json: { tab: 'watch' } },
        { id: 'f2', name: '3D Graphics & Animation', json: { tab: 'watch' } },
        { id: 'f3', name: 'Physics & Quantum Science', json: { tab: 'watch' } },
        { id: 'f4', name: 'Earth & Nature Documentaries', json: { tab: 'watch' } },
        { id: 'f5', name: 'Science & Tutorials', json: { tab: 'watch' } }
      ]);

      bookmarks$.bookmarks.set([
        {
          id: 'b1',
          url: 'https://www.youtube.com/watch?v=moon',
          title: 'Tour of the Moon in 4K (Redux)',
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-01'),
          json: { thumbnail: '/demo-assets/moon.jpg' }
        },
        {
          id: 'b2',
          url: 'https://www.youtube.com/watch?v=sun',
          title: 'Thermonuclear Art: The Sun in Ultra HD',
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-01'),
          json: { thumbnail: '/demo-assets/sun.jpg' }
        },
        {
          id: 'b3',
          url: 'https://www.youtube.com/watch?v=galaxy',
          title: 'Deep Space Galaxy Survey: Webb Telescope Observations',
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-01'),
          json: { thumbnail: '/demo-assets/galaxy.jpg' }
        },
        {
          id: 'b4',
          url: 'https://www.youtube.com/watch?v=quantum',
          title: 'The Real Story Behind the Quantum Revolution',
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-01'),
          json: { thumbnail: '/demo-assets/quantum.jpg' }
        },
        {
          id: 'b5',
          url: 'https://www.youtube.com/watch?v=blender',
          title: 'Blender 4.3 Feature Reel: EEVEE Next',
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-01'),
          json: { thumbnail: '/demo-assets/blender.jpg' }
        },
        {
          id: 'b6',
          url: 'https://www.youtube.com/watch?v=earth',
          title: 'Blue Marble: High Definition Earth from Space',
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-01'),
          json: { thumbnail: '/demo-assets/earth.jpg' }
        },
        {
          id: 'b7',
          url: 'https://www.youtube.com/watch?v=mars',
          title: 'Curiosity & Perseverance: Exploring Mars Craters',
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-01'),
          json: { thumbnail: '/demo-assets/mars.jpg' }
        },
        {
          id: 'b8',
          url: 'https://www.youtube.com/watch?v=jupiter',
          title: 'Juno: Close Encounters with the Great Red Spot',
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-01'),
          json: { thumbnail: '/demo-assets/jupiter.jpg' }
        }
      ]);

      ui$.libraryModalOpen.set(true);
    `,
    action: `
      window.renderMockPage({
        mode: 'yt-music',
        albums: [
          { thumb: '/demo-assets/aurora.jpg', title: 'Orbital Ambient Sessions', artist: 'Solaris • Album' },
          { thumb: '/demo-assets/galaxy.jpg', title: 'Deep Space Soundscapes', artist: 'Nebula Project • Playlist' },
          { thumb: '/demo-assets/jupiter.jpg', title: 'Voyager Frequencies', artist: 'Cassini Waves • EP' },
          { thumb: '/demo-assets/blender.jpg', title: 'Acoustic Meadow Mix', artist: 'Studio Open • Album' }
        ]
      });
    `,
    waitMs: 800,
  },
  {
    name: '05-history',
    num: 5,
    setup: `
      const { ui$, settings$, tabs$, history$ } = window.__noutube;
      settings$.theme.set('dark');
      tabs$.tabs.set([
        { id: '1', title: 'Watch History', url: 'noutube://history' },
        { id: '2', title: 'The Quantum Revolution', url: 'https://images.nasa.gov/details/PIA26141' }
      ]);
      tabs$.activeTabIndex.set(0);

      history$.bookmarks.set([
        {
          id: 'h1',
          url: 'https://www.youtube.com/watch?v=moon',
          title: 'Tour of the Moon in 4K (Redux)',
          thumbnail: '/demo-assets/moon.jpg',
          current: 240,
          duration: 300,
          created_at: new Date(Date.now() - 2 * 3600 * 1000)
        },
        {
          id: 'h2',
          url: 'https://www.youtube.com/watch?v=blender',
          title: 'Blender 4.3 Feature Reel: EEVEE Next & Geometry Nodes',
          thumbnail: '/demo-assets/blender.jpg',
          current: 120,
          duration: 280,
          created_at: new Date(Date.now() - 5 * 3600 * 1000)
        },
        {
          id: 'h3',
          url: 'https://www.youtube.com/watch?v=quantum',
          title: 'The Real Story Behind the Quantum Revolution',
          thumbnail: '/demo-assets/quantum.jpg',
          current: 870,
          duration: 1125,
          created_at: new Date(Date.now() - 24 * 3600 * 1000)
        },
        {
          id: 'h4',
          url: 'https://www.youtube.com/watch?v=sun',
          title: 'Thermonuclear Art: The Sun in Ultra HD',
          thumbnail: '/demo-assets/sun.jpg',
          current: 765,
          duration: 1800,
          created_at: new Date(Date.now() - 48 * 3600 * 1000)
        },
        {
          id: 'h5',
          url: 'https://www.youtube.com/watch?v=galaxy',
          title: 'Deep Space Galaxy Survey: Webb Telescope Observations',
          thumbnail: '/demo-assets/galaxy.jpg',
          current: 494,
          duration: 900,
          created_at: new Date(Date.now() - 72 * 3600 * 1000)
        },
        {
          id: 'h6',
          url: 'https://www.youtube.com/watch?v=earth',
          title: 'Blue Marble: High Definition Earth from Space',
          thumbnail: '/demo-assets/earth.jpg',
          current: 310,
          duration: 320,
          created_at: new Date(Date.now() - 96 * 3600 * 1000)
        },
        {
          id: 'h7',
          url: 'https://www.youtube.com/watch?v=mars',
          title: 'Curiosity & Perseverance: Exploring Mars Craters',
          thumbnail: '/demo-assets/mars.jpg',
          current: 150,
          duration: 450,
          created_at: new Date(Date.now() - 120 * 3600 * 1000)
        },
        {
          id: 'h8',
          url: 'https://www.youtube.com/watch?v=aurora',
          title: 'Aurora Borealis Observed from Orbit',
          thumbnail: '/demo-assets/aurora.jpg',
          current: 80,
          duration: 240,
          created_at: new Date(Date.now() - 144 * 3600 * 1000)
        }
      ]);

      ui$.historyModalOpen.set(true);
    `,
    action: `
      window.renderMockPage({
        mode: 'yt-watch',
        leftPad: 448,
        title: 'The Real Story Behind the Quantum Revolution',
        channel: 'Veritasium • 2.4M views',
        time: '14:32 / 18:45',
        image: '/demo-assets/quantum.jpg',
        progress: 0.77
      });
    `,
    waitMs: 800,
  },
  {
    name: '06-controls',
    num: 6,
    setup: `
      const { ui$, settings$, tabs$ } = window.__noutube;
      settings$.theme.set('dark');
      settings$.playbackRate.set(1.25);
      settings$.playbackQuality.set('2160p');
      tabs$.tabs.set([
        { id: '1', title: 'Tour of the Moon in 4K', url: 'https://svs.gsfc.nasa.gov/4619' },
        { id: '2', title: 'Personal Feeds', url: 'noutube://feeds' }
      ]);
      tabs$.activeTabIndex.set(0);

      window.renderMockPlayer({
        title: 'Tour of the Moon in 4K (Redux)',
        channel: 'NASA Goddard Space Flight Center',
        time: '03:42 / 05:00',
        image: '/demo-assets/moon.jpg',
        badges: ['Ad-Free', '4K UHD (2160p)', '1.25x Speed'],
        progress: 0.74
      });

      ui$.playbackSpeedModalOpen.set(true);
    `,
    waitMs: 800,
  },
]

async function captureAll() {
  server.listen(0, '127.0.0.1')
  await new Promise((r) => setTimeout(r, 300))
  const port = (server.address() as any).port
  console.log('Test server running on port', port)

  const tmpDir = '/tmp/chrome-user-store-' + Date.now()
  const debugPort = 9240 + Math.floor(Math.random() * 200)
  const chrome = spawn(
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    [
      '--headless=new',
      '--user-data-dir=' + tmpDir,
      `--remote-debugging-port=${debugPort}`,
      '--window-size=1024,575',
      `http://127.0.0.1:${port}`,
    ],
  )

  let pageTab: any = null
  let lastTabs: any = null
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500))
    try {
      const tabsRes = await fetch(`http://127.0.0.1:${debugPort}/json`)
      const tabs: any = await tabsRes.json()
      lastTabs = tabs
      pageTab = tabs.find((t: any) => t.type === 'page' && t.url.includes(String(port))) || tabs.find((t: any) => t.type === 'page')
      if (pageTab) break
    } catch {}
  }

  if (!pageTab) {
    chrome.kill()
    console.error('Last tabs:', lastTabs)
    throw new Error('Could not find Chrome page tab')
  }

  const ws = new WebSocket(pageTab.webSocketDebuggerUrl)
  await new Promise((r) => ws.on('open', r))
  console.log('Connected to Chrome DevTools Protocol')

  let msgId = 1
  function sendCdp(method: string, params: any = {}): Promise<any> {
    const id = ++msgId
    return new Promise((resolve) => {
      const handler = (data: any) => {
        const msg = JSON.parse(data.toString())
        if (msg.id === id) {
          ws.off('message', handler)
          resolve(msg.result)
        }
      }
      ws.on('message', handler)
      ws.send(JSON.stringify({ id, method, params }))
    })
  }

  await sendCdp('Emulation.setDeviceMetricsOverride', {
    width: 1024,
    height: 575,
    deviceScaleFactor: 2000 / 1024,
    mobile: false,
  })

  for (let i = 0; i < 20; i++) {
    const ready = await sendCdp('Runtime.evaluate', { expression: 'Boolean(window.__noutube)' })
    if (ready?.result?.value) break
    await new Promise((r) => setTimeout(r, 300))
  }

  for (const task of TASKS) {
    console.log(`Setting up ${task.name}...`)
    // Reset state first
    await sendCdp('Runtime.evaluate', {
      expression: `
        (() => {
          if (window.__noutube) {
            const { ui$ } = window.__noutube;
            ui$.feedModalOpen.set(false);
            ui$.settingsModalOpen.set(false);
            ui$.libraryModalOpen.set(false);
            ui$.historyModalOpen.set(false);
            ui$.playbackSpeedModalOpen.set(false);
            const bg = document.getElementById('mock-player-bg');
            if (bg) bg.remove();
            const main = document.getElementById('mock-main-player');
            if (main) main.remove();
          }
        })()
      `,
    })
    await new Promise((r) => setTimeout(r, 200))

    // Run setup
    const setupCode = `(() => {\n${task.setup}\n})()`
    const setupRes = await sendCdp('Runtime.evaluate', { expression: setupCode })
    if (setupRes?.exceptionDetails) {
      console.error(`Error in setup for ${task.name}:`, setupRes.exceptionDetails)
    }
    if (task.action) {
      await new Promise((r) => setTimeout(r, 400))
      const actionCode = `(() => {\n${task.action}\n})()`
      const actionRes = await sendCdp('Runtime.evaluate', { expression: actionCode })
      if (actionRes?.exceptionDetails) {
        console.error(`Error in action for ${task.name}:`, actionRes.exceptionDetails)
      }
    }
    await new Promise((r) => setTimeout(r, task.waitMs || 600))

    // Capture screenshot
    const res = await sendCdp('Page.captureScreenshot', { format: 'png' })
    if (res?.data) {
      const buf = Buffer.from(res.data, 'base64')
      for (const dir of OUT_DIRS) {
        fs.writeFileSync(path.join(dir, `${task.name}.png`), buf)
        fs.writeFileSync(path.join(dir, `${task.num}.png`), buf)
      }
      console.log(`Saved: ${task.name}.png to mstore/ (${buf.length} bytes)`)
    }
  }

  chrome.kill()
  server.close()
  console.log('All 6 screenshots captured successfully!')
}

captureAll().catch((err) => {
  console.error('Error capturing screenshots:', err)
  process.exit(1)
})
