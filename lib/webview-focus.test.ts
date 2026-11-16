import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { ObservableHint } from '@legendapp/state'
import { ui$ } from '@/states/ui'
import { onPointerDown, onPointerUp, openModal, scheduleWebviewRefocus } from './webview-focus'

const flush = () => new Promise((resolve) => setTimeout(resolve, 5))

const fakeElement = (tagName: string) => ({
  tagName,
  blurred: 0,
  blur() {
    this.blurred++
    fakeDocument.activeElement = fakeDocument.body
  },
})

const fakeDocument = {
  body: fakeElement('BODY'),
  activeElement: null as any,
  menuOpen: false,
  querySelector(selector: string) {
    return selector === '[role="menu"]' && this.menuOpen ? {} : null
  },
}

const webview = {
  ...fakeElement('WEBVIEW'),
  focused: 0,
  focus() {
    this.focused++
    fakeDocument.activeElement = webview
  },
}

const originalDocument = globalThis.document

describe('webview focus', () => {
  beforeEach(() => {
    ;(globalThis as any).document = fakeDocument
    fakeDocument.activeElement = fakeDocument.body
    fakeDocument.menuOpen = false
    webview.focused = 0
    webview.blurred = 0
    ui$.webview.set(ObservableHint.opaque(webview))
  })

  afterEach(async () => {
    await flush()
    ;(globalThis as any).document = originalDocument
  })

  it('returns focus to the webview when it lands in the app shell', async () => {
    fakeDocument.activeElement = fakeElement('DIV')
    scheduleWebviewRefocus()
    await flush()
    expect(webview.focused).toBe(1)
  })

  it('leaves text inputs, open menus and the webview itself alone', async () => {
    fakeDocument.activeElement = fakeElement('INPUT')
    scheduleWebviewRefocus()
    await flush()

    fakeDocument.activeElement = fakeElement('DIV')
    fakeDocument.menuOpen = true
    scheduleWebviewRefocus()
    await flush()

    fakeDocument.menuOpen = false
    fakeDocument.activeElement = webview
    scheduleWebviewRefocus()
    await flush()

    expect(webview.focused).toBe(0)
  })

  it('waits for the pointer to be released', async () => {
    fakeDocument.activeElement = fakeElement('DIV')
    onPointerDown()
    scheduleWebviewRefocus()
    await flush()
    expect(webview.focused).toBe(0)

    onPointerUp()
    await flush()
    expect(webview.focused).toBe(1)
  })

  it('leaves focus alone while a modal is open and refocuses after the last closes', async () => {
    const closeSettings = openModal()
    const closeUrl = openModal()
    fakeDocument.activeElement = fakeElement('DIV')
    scheduleWebviewRefocus()
    await flush()
    expect(webview.focused).toBe(0)

    closeUrl()
    await flush()
    expect(webview.focused).toBe(0)

    closeSettings()
    await flush()
    expect(webview.focused).toBe(1)
  })

  it('counts a modal closed twice only once', async () => {
    const closeA = openModal()
    const closeB = openModal()
    closeA()
    closeA()
    await flush()
    expect(webview.focused).toBe(0)
    closeB()
    await flush()
    expect(webview.focused).toBe(1)
  })

  it('pulls focus out of the webview when a modal opens, so Escape reaches the app', async () => {
    fakeDocument.activeElement = webview
    const close = openModal()
    expect(webview.blurred).toBe(1)
    expect(fakeDocument.activeElement).toBe(fakeDocument.body)

    close()
    await flush()
    expect(webview.focused).toBe(1)
  })
})
