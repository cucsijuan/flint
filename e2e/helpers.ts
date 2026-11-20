import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Key } from 'webdriverio'

export const vaultFile = (path: string) =>
  readFileSync(join(process.env.FLINT_E2E_VAULT ?? '', path), 'utf8')

export const writeVaultFile = (path: string, text: string) =>
  writeFileSync(join(process.env.FLINT_E2E_VAULT ?? '', path), text)

export async function waitForVault() {
  await $('.vault').waitForDisplayed()
  // The window shows itself only once the vault is restored; clicks before that can miss.
  await browser.waitUntil(() =>
    browser.execute(() =>
      (
        window as unknown as {
          __TAURI_INTERNALS__: { invoke: (command: string) => Promise<boolean> }
        }
      ).__TAURI_INTERNALS__.invoke('plugin:window|is_visible'),
    ),
  )
}

export const expectText = (
  selector: string,
  text: string | ExpectWebdriverIO.PartialMatcher<string>,
) => expect($(selector)).toHaveElementProperty('textContent', text)

export const expectOpenNote = (name: string) => expectText('.note h1', name)

export async function openFromTree(name: string) {
  await $(`button.row*=${name}`).click()
  await expectOpenNote(name)
  // Off the tree, or a later Ctrl shortcut opens the row's page preview over it.
  await $('.note h1').moveTo()
}

export const pressShortcut = (...keys: string[]) => browser.keys([Key.Ctrl, ...keys])
