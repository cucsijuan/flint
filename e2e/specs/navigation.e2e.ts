import { Key } from 'webdriverio'
import { pressShortcut, waitForVault } from '../helpers'

describe('navigation', () => {
  before(waitForVault)

  it('opens notes from the quick switcher', async () => {
    await pressShortcut('o')
    await $('.picker-input').setValue('idea')
    await browser.keys(['Enter'])
    await expect($('.note h1')).toHaveText('Ideas')
  })

  it('runs commands from the palette', async () => {
    await pressShortcut('p')
    await $('.picker-input').setValue('open graph')
    await browser.keys(['Enter'])
    await expect($('.graph canvas')).toBeDisplayed()
  })

  it('finds notes with full-text search', async () => {
    await pressShortcut(Key.Shift, 'f')
    await $('input[type=search]').setValue('"search feature"')
    await expect($('.note*=Roadmap')).toBeDisplayed()
    await expect($('.highlight=search feature')).toBeDisplayed()
  })
})
