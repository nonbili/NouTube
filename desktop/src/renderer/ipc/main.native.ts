export const mainClient = new Proxy(
  {},
  {
    get(_target, name) {
      return () => {}
    },
  },
)
