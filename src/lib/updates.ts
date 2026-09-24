import { ask } from '@tauri-apps/plugin-dialog'
import { relaunch } from '@tauri-apps/plugin-process'
import { check } from '@tauri-apps/plugin-updater'
import { workspace } from './workspace.svelte'

export async function checkForUpdates({ isManual }: { isManual: boolean }) {
  try {
    const update = await check()
    if (!update) {
      if (isManual) workspace.notify('Flint is up to date.')
      return
    }
    const shouldInstall = await ask(
      `Flint ${update.version} is available (you have ${update.currentVersion}). Install it and restart?`,
      { title: 'Update available', okLabel: 'Install and restart', cancelLabel: 'Later' },
    )
    if (!shouldInstall) return
    await workspace.flush()
    await update.downloadAndInstall()
    await relaunch()
  } catch (error) {
    if (isManual) workspace.notify(`Could not update: ${String(error)}`)
    else console.warn('update check failed', error)
  }
}
