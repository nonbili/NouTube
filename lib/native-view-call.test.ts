import { describe, expect, it } from 'bun:test'
import { retryNativeViewCall } from './native-view-call'

const settle = async () => {
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setTimeout(resolve, 60))
  }
}

describe('retryNativeViewCall', () => {
  it('retries until the native view is there', async () => {
    let attempts = 0
    retryNativeViewCall(
      () => {
        attempts++
        return attempts < 3 ? Promise.reject(new Error('Unable to find the view with tag 1')) : Promise.resolve()
      },
      () => false,
    )
    await settle()
    expect(attempts).toBe(3)
  })

  it('stops as soon as the call is stale', async () => {
    let attempts = 0
    let stale = false
    retryNativeViewCall(
      () => {
        attempts++
        stale = true
        return Promise.reject(new Error('nope'))
      },
      () => stale,
    )
    await settle()
    expect(attempts).toBe(1)
  })

  it('does not run an attempt that went stale while its retry was waiting', async () => {
    let attempts = 0
    let stale = false
    retryNativeViewCall(
      () => {
        attempts++
        return Promise.reject(new Error('nope'))
      },
      () => stale,
    )
    // After the first failure but before its retry fires.
    await new Promise((resolve) => setTimeout(resolve, 20))
    stale = true
    await settle()
    expect(attempts).toBe(1)
  })

  it('leaves a call that never returns a promise alone', async () => {
    let attempts = 0
    retryNativeViewCall(
      () => {
        attempts++
      },
      () => false,
    )
    await settle()
    expect(attempts).toBe(1)
  })
})
