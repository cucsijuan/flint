import { Key } from 'webdriverio'
import { expectText, pressShortcut, vaultFile, waitForVault } from '../helpers'

const tabTitles = async () => {
  const titles = await $$('.tab .title').map((title) => title.getProperty('textContent'))
  return titles.map(String)
}

describe('tabs and panes', () => {
  before(waitForVault)

  it('opens notes in new tabs with Ctrl+click and closes them with Ctrl+W', async () => {
    await $('button.row*=Welcome').click()
    await browser.performActions([
      {
        type: 'key',
        id: 'keyboard',
        actions: [{ type: 'keyDown', value: Key.Ctrl }],
      },
    ])
    await $('button.row*=Ideas').click()
    await browser.releaseActions()
    await browser.waitUntil(async () => (await tabTitles()).join() === 'Welcome,Ideas')

    await pressShortcut('w')
    await browser.waitUntil(async () => (await tabTitles()).join() === 'Welcome')
  })

  it('splits the active tab and keeps both panes in sync', async () => {
    await pressShortcut('p')
    await $('.picker-input').setValue('split right')
    await browser.keys(['Enter'])
    await browser.waitUntil(async () => (await $$('.group').length) === 2)

    const editors = await $$('.group .view:not([hidden]) .cm-content')
    await editors[1].click()
    await browser.keys([Key.Ctrl, 'End'])
    await browser.keys(' Typed in the second pane.')

    await browser.waitUntil(async () =>
      String(await editors[0].getProperty('textContent')).includes('Typed in the second pane.'),
    )
    await browser.waitUntil(() => vaultFile('Welcome.md').includes('Typed in the second pane.'))
  })

  it('navigates back and forward within a tab', async () => {
    await $('.group.active .cm-live-link=Roadmap').click()
    await expectText('.group.active .view:not([hidden]) .note h1', 'Roadmap')
    await browser.keys([Key.Alt, Key.ArrowLeft])
    await expectText('.group.active .view:not([hidden]) .note h1', 'Welcome')
    await browser.keys([Key.Alt, Key.ArrowRight])
    await expectText('.group.active .view:not([hidden]) .note h1', 'Roadmap')
  })
})
