const interfaces = {
  fetchFeed: async (url: string) => {
    const res = await fetch(url)
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      body: await res.text(),
    }
  },
}

type MainInterface = typeof interfaces
type MainInterfaceKey = keyof MainInterface

export const mainClient = new Proxy(
  {},
  {
    get(_target, name) {
      return interfaces[name as MainInterfaceKey] || (() => {})
    },
  },
)
