const interfaces = {
  fetchFeed: async (url: string) => {
    const res = await fetch(url)
    return await res.text()
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
