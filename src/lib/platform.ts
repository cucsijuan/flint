import { platform } from '@tauri-apps/plugin-os'

const current = (() => {
  try {
    return platform()
  } catch {
    // Outside Tauri (tests): desktop.
    return 'linux'
  }
})()

export const isAndroid = current === 'android'
export const isIos = current === 'ios'
/** Phones and tablets: one window, touch, no system trash or updater. */
export const isMobile = isAndroid || isIos
