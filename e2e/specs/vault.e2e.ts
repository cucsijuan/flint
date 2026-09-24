import { openFromTree, vaultFile, waitForVault } from '../helpers'

describe('vault and editor', () => {
  before(waitForVault)

  it('opens the vault passed on the command line', async () => {
    await expect($('.vault')).toHaveText(expect.stringContaining('vault-'))
    await expect($('button.row*=Projects')).toBeDisplayed()
    await expect($('button.row*=Welcome')).toBeDisplayed()
  })

  it('renders notes in live preview', async () => {
    await openFromTree('Welcome')
    await expect($('.cm-live-link=Roadmap')).toBeDisplayed()
    await expect($('.cm-live-tag=#testing')).toBeDisplayed()
  })

  it('saves edits to disk', async () => {
    await openFromTree('Ideas')
    await $('.cm-content').click()
    await browser.keys(['End'])
    await browser.keys(' Saved by the test.')
    await browser.waitUntil(() => vaultFile('Ideas.md').includes('Saved by the test.'), {
      timeoutMsg: 'the edit was not written to disk',
    })
  })
})
