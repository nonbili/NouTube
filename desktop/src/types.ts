/// <reference types="vite/client" />

declare global {
  interface Window {
    noutubeDeeplink: (link: string) => void
  }
}

export {}
