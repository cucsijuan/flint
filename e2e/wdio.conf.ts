import { type ChildProcess, spawn } from 'node:child_process'
import { connect } from 'node:net'
import { download as downloadEdgeDriver } from 'edgedriver'
import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const isWindows = process.platform === 'win32'
const root = resolve(import.meta.dirname, '..')
const application = join(root, 'src-tauri', 'target', 'debug', isWindows ? 'flint.exe' : 'flint')
const tauriDriver =
  process.env.TAURI_DRIVER ??
  join(homedir(), '.cargo', 'bin', isWindows ? 'tauri-driver.exe' : 'tauri-driver')

const DRIVER_PORT = 4444

const sandbox = (process.env.FLINT_E2E_SANDBOX ??= mkdtempSync(join(tmpdir(), 'flint-e2e-')))
let driver: ChildProcess | undefined

async function waitForPort(port: number, attempts = 50) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const isOpen = await new Promise<boolean>((resolvePort) => {
      const socket = connect(port, '127.0.0.1')
      socket.once('connect', () => resolvePort(socket.end() && true))
      socket.once('error', () => resolvePort(false))
    })
    if (isOpen) return
    await new Promise((wait) => setTimeout(wait, 200))
  }
  throw new Error(`tauri-driver did not start on port ${port}`)
}

export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: ['./specs/**/*.e2e.ts'],
  maxInstances: 1,
  hostname: '127.0.0.1',
  port: DRIVER_PORT,
  capabilities: [{ 'tauri:options': { application } } as WebdriverIO.Capabilities],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: { ui: 'bdd', timeout: 60_000 },
  waitforTimeout: 10_000,
  logLevel: 'warn',

  beforeSession(_config, capabilities) {
    const vault = mkdtempSync(join(sandbox, 'vault-'))
    cpSync(join(root, 'e2e', 'fixtures', 'vault'), vault, { recursive: true })
    process.env.FLINT_E2E_VAULT = vault
    const options = (capabilities as Record<string, { args?: string[] }>)['tauri:options']
    options.args = [vault]
  },

  async onPrepare() {
    const nativeDriver =
      process.env.NATIVE_DRIVER ?? (isWindows ? await downloadEdgeDriver() : undefined)
    const args = nativeDriver ? ['--native-driver', nativeDriver] : []
    driver = spawn(tauriDriver, args, {
      stdio: ['ignore', 'inherit', 'inherit'],
      env: {
        ...process.env,
        XDG_CONFIG_HOME: join(sandbox, 'config'),
        XDG_DATA_HOME: join(sandbox, 'data'),
        GDK_BACKEND: 'x11',
      },
    })
    await waitForPort(DRIVER_PORT)
  },

  onComplete() {
    driver?.kill()
    rmSync(sandbox, { recursive: true, force: true })
  },
}
