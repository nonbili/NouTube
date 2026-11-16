import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { settings$ } from '@/states/settings'

mock.module('@/modules/nou-tube-view', () => ({ default: {} }))
const requestDirectoryPermissionsAsync = mock(async (_initialUri: string | null): Promise<{
  granted: boolean
  directoryUri?: string
}> => ({ granted: false }))
mock.module('expo-file-system/legacy', () => ({
  StorageAccessFramework: { requestDirectoryPermissionsAsync },
}))

const { mainClient } = await import('./main-client.native')

beforeEach(() => {
  settings$.downloadPath.set('')
  requestDirectoryPermissionsAsync.mockClear()
  requestDirectoryPermissionsAsync.mockImplementation(async () => ({ granted: false }))
})

describe('Android download folder selection', () => {
  test('returns the selected tree URI', async () => {
    const directoryUri = 'content://com.android.externalstorage.documents/tree/primary%3AMusic'
    requestDirectoryPermissionsAsync.mockImplementation(async () => ({ granted: true, directoryUri }))
    expect(await mainClient.selectFolder()).toBe(directoryUri)
    expect(requestDirectoryPermissionsAsync).toHaveBeenCalledWith(null)
  })

  test('starts in the previously selected folder and preserves it on cancellation', async () => {
    const directoryUri = 'content://com.android.externalstorage.documents/tree/primary%3AMusic'
    settings$.downloadPath.set(directoryUri)
    expect(await mainClient.selectFolder()).toBeNull()
    expect(requestDirectoryPermissionsAsync).toHaveBeenCalledWith(directoryUri)
    expect(settings$.downloadPath.peek()).toBe(directoryUri)
  })

  test('does not pass a filesystem path to the Android picker', async () => {
    settings$.downloadPath.set('/home/user/Downloads')
    expect(await mainClient.selectFolder()).toBeNull()
    expect(requestDirectoryPermissionsAsync).toHaveBeenCalledWith(null)
  })

  test('propagates picker failures for the dialog to display', async () => {
    requestDirectoryPermissionsAsync.mockImplementation(async () => { throw new Error('Picker unavailable') })
    await expect(mainClient.selectFolder()).rejects.toThrow('Picker unavailable')
  })
})
