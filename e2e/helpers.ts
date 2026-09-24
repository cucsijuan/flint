import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Key } from 'webdriverio'

export const vaultFile = (path: string) =>
  readFileSync(join(process.env.FLINT_E2E_VAULT ?? '', path), 'utf8')

export async function waitForVault() {
  await $('.vault').waitForDisplayed()
}

export async function openFromTree(name: string) {
  await $(`button.row*=${name}`).click()
  await expect($('.note h1')).toHaveText(name)
}

export const pressShortcut = (...keys: string[]) => browser.keys([Key.Ctrl, ...keys])
