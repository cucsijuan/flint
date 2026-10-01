import { Key } from 'webdriverio'
import { pressShortcut, waitForVault } from '../helpers'

const backgroundBrightness = () =>
  browser.execute(() => {
    const [red, green, blue] = (getComputedStyle(document.body).backgroundColor.match(/\d+/g) ?? [])
      .slice(0, 3)
      .map(Number)
    return (red + green + blue) / 3
  })

/** The graph's node color as its canvas code resolves it: through a probe element. */
const graphNodeColor = () =>
  browser.execute(() => {
    const probe = document.createElement('span')
    probe.style.color = 'var(--graph-node)'
    document.body.append(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    return color
  })

describe('theme', () => {
  before(waitForVault)

  it('switches between dark and light, graph colors included', async () => {
    await pressShortcut('g')
    await expect($('.graph canvas')).toBeDisplayed()
    await pressShortcut(',')
    await $('.settings nav').$('button=Appearance').click()
    const theme = $('.settings .content select')

    await theme.selectByAttribute('value', 'dark')
    await browser.waitUntil(async () => (await backgroundBrightness()) < 80)
    const darkNodes = await graphNodeColor()

    await theme.selectByAttribute('value', 'light')
    await browser.waitUntil(async () => (await backgroundBrightness()) > 180)
    expect(await graphNodeColor()).not.toBe(darkNodes)

    await browser.keys(Key.Escape)
    await expect($('.graph canvas')).toBeDisplayed()
  })
})
