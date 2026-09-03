/*
 * YouTube creates Trusted Types policies during startup. Keep its native
 * factory intact while making duplicate/rejected policy names non-fatal for
 * NouTube's own policy creation.
 */
export const createTrustedTypesProxy = (trustedTypes: any) => {
  const createPolicy = trustedTypes.createPolicy.bind(trustedTypes)
  const safeCreatePolicy = (name: string, rules: any) => {
    try {
      return createPolicy(name, rules)
    } catch {
      return rules
    }
  }

  return new Proxy(trustedTypes, {
    get(target, property) {
      if (property === 'createPolicy') {
        return safeCreatePolicy
      }
      // Native accessors (for example `emptyHTML`) brand-check `this`.
      // Reading against the Proxy would make Chromium throw "Illegal
      // invocation", so both accessors and methods use the actual factory.
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}
