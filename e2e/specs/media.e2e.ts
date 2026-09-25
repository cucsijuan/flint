import { expectText, openFromTree, pressShortcut, waitForVault } from '../helpers'

describe('rich content', () => {
  before(waitForVault)

  it('shows images, tables and embedded notes in live preview', async () => {
    await openFromTree('Media')
    await expect($('.cm-live-image')).toBeExisting()
    await expect($('.cm-live-table table')).toBeExisting()
    await expectText('.cm-live-embed .embed-body', expect.stringContaining('A quiet note'))
  })

  it('toggles the reading view with Ctrl+E', async () => {
    await pressShortcut('e')
    await expect($('.reading .markdown table')).toBeExisting()
    await expect($('.reading .markdown img')).toHaveAttribute(
      'src',
      expect.stringContaining('pic.png'),
    )
    await expectText('.reading .note-embed .embed-body', expect.stringContaining('A quiet note'))

    await pressShortcut('e')
    await expect($('.reading')).not.toBeExisting()
  })

  it('opens images from the file tree in a viewer tab', async () => {
    await $('button.row*=pic').click()
    await expect($('figure img')).toHaveAttribute('src', expect.stringContaining('pic.png'))
  })
})
