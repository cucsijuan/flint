import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Key } from 'webdriverio'

export const vaultFile = (path: string) =>
  readFileSync(join(process.env.FLINT_E2E_VAULT ?? '', path), 'utf8')

export async function waitForVault() {
  await $('.vault').waitForDisplayed()
}

export const expectText = (
  selector: string,
  text: string | ExpectWebdriverIO.PartialMatcher<string>,
) => expect($(selector)).toHaveElementProperty('textContent', text)

export const expectOpenNote = (name: string) => expectText('.note h1', name)

export async function openFromTree(name: string) {
  await $(`button.row*=${name}`).click()
  await expectOpenNote(name)
}

export const pressShortcut = (...keys: string[]) => browser.keys([Key.Ctrl, ...keys])
