import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { openFromTree, waitForVault, writeVaultFile } from '../helpers'

describe('web viewer', () => {
  let hasLoaded = false
  // The page calls back once its scripts run, which shows it loaded in a working window.
  const server = createServer((request, response) => {
    if (request.url === '/loaded') hasLoaded = true
    response.writeHead(200, { 'content-type': 'text/html' })
    response.end('<!doctype html><title>Test page</title><script>fetch("/loaded")</script>')
  })

  before(async () => {
    await waitForVault()
    await new Promise<void>((listening) => server.listen(0, '127.0.0.1', listening))
    const { port } = server.address() as AddressInfo
    writeVaultFile('Web.md', `# Web\n\n[Test page](http://127.0.0.1:${port}/)\n`)
  })

  after(() => server.close())

  it('opens web links in a window of their own, and Flint keeps working', async () => {
    await openFromTree('Web')
    await $('.cm-live-link=Test page').click()
    await browser.waitUntil(() => hasLoaded, {
      timeoutMsg: 'the page never loaded in the web viewer',
    })
    await openFromTree('Welcome')
  })
})
