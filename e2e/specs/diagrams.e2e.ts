import { openFromTree, pressShortcut, waitForVault } from '../helpers'

describe('diagrams', () => {
  before(waitForVault)

  it('renders Mermaid diagrams in live preview, with a toolbar', async () => {
    await openFromTree('Diagram')
    await expect($('.cm-live-block .diagram-image svg')).toBeExisting()
    await expect($('.cm-live-block .diagram-toolbar [data-diagram-action="png"]')).toBeExisting()
  })

  it('opens a diagram full size, zooms it and closes with Escape', async () => {
    await $('.cm-live-block .diagram').moveTo()
    await $('.cm-live-block [data-diagram-action="open"]').click()
    await expect($('.diagram-viewer .diagram-image svg')).toBeExisting()

    const zoom = $('.diagram-viewer button[title^="Actual size"]')
    await browser.keys(['1'])
    await expect(zoom).toHaveText('100%')
    await browser.keys(['+'])
    await expect(zoom).toHaveText('125%')
    await zoom.click()
    await expect(zoom).toHaveText('100%')

    await browser.keys(['Escape'])
    await expect($('.diagram-viewer')).not.toBeExisting()
  })

  it('renders diagrams in the reading view', async () => {
    await pressShortcut('e')
    await expect($('.reading .diagram-image svg')).toBeExisting()
    await pressShortcut('e')
  })
})
