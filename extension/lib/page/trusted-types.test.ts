import { describe, expect, test } from 'bun:test'
import { createTrustedTypesProxy } from './trusted-types'

describe('trusted types proxy', () => {
  test('uses the native factory as the receiver for accessors and methods', () => {
    const factory = {
      get emptyHTML() {
        if (this !== factory) throw new TypeError('Illegal invocation')
        return 'trusted empty html'
      },
      createPolicy(_name: string, rules: unknown) {
        if (this !== factory) throw new TypeError('Illegal invocation')
        return rules
      },
      isHTML() {
        if (this !== factory) throw new TypeError('Illegal invocation')
        return true
      },
    }

    const trustedTypes = createTrustedTypesProxy(factory)

    expect(trustedTypes.emptyHTML).toBe('trusted empty html')
    expect(trustedTypes.isHTML()).toBe(true)
    expect(trustedTypes.createPolicy('noutube', { createHTML: String })).toEqual({ createHTML: String })
  })

  test('falls back to the policy rules when policy creation is rejected', () => {
    const rules = { createHTML: String }
    const trustedTypes = createTrustedTypesProxy({
      createPolicy() {
        throw new TypeError('Policy name already used')
      },
    })

    expect(trustedTypes.createPolicy('noutube', rules)).toBe(rules)
  })
})
