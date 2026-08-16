import { useValue } from '@legendapp/state/react'
import { settings$ } from '@/states/settings'
import { ui$ } from '@/states/ui'

function resolve(isYTMusic: boolean, systemDesktopMode: boolean, override: boolean | undefined) {
  if (systemDesktopMode) {
    return override ?? true
  }
  return isYTMusic ? settings$.desktopMode.get() : settings$.desktopModeYT.get()
}

/**
 * Resolves the desktop-site choice for the current site.
 *
 * Android desktop mode (an external monitor or Samsung DeX) only sets the
 * *default*: while it lasts we serve the desktop site, but a manual toggle
 * still wins for that session. Returning to the phone screen clears the
 * override and the persisted per-site settings apply again.
 */
export function useDesktopMode(isYTMusic: boolean) {
  const desktopModeYTMusic = useValue(settings$.desktopMode)
  const desktopModeYT = useValue(settings$.desktopModeYT)
  const systemDesktopMode = useValue(ui$.systemDesktopMode)
  const desktopModeOverride = useValue(ui$.desktopModeOverride)

  if (systemDesktopMode) {
    return desktopModeOverride ?? true
  }
  return isYTMusic ? desktopModeYTMusic : desktopModeYT
}

/** Flips the desktop-site choice, honouring the desktop-mode override above. */
export function toggleDesktopMode(isYTMusic: boolean) {
  const systemDesktopMode = ui$.systemDesktopMode.get()
  const current = resolve(isYTMusic, systemDesktopMode, ui$.desktopModeOverride.get())
  if (systemDesktopMode) {
    ui$.desktopModeOverride.set(!current)
    return
  }
  const key = isYTMusic ? settings$.desktopMode : settings$.desktopModeYT
  key.set(!current)
}
