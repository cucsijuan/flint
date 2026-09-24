import { openFromTree, waitForVault } from '../helpers'

describe('wikilinks', () => {
  before(waitForVault)

  it('opens the target of a clicked link', async () => {
    await openFromTree('Welcome')
    await $('.cm-live-link=Roadmap').click()
    await expect($('.note h1')).toHaveText('Roadmap')
  })

  it('lists backlinks for the open note', async () => {
    await expect($('.source=Welcome')).toBeDisplayed()
  })
})
