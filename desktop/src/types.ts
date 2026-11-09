/// <reference types="vite/client" />

declare global {
  interface Window {
    noutubeDeeplink: (link: string, newTab?: boolean) => void
  }
}

export {}
