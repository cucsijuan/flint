import { type ChildProcess, execFileSync, spawn } from 'node:child_process'
import { connect } from 'node:net'
import { download as downloadEdgeDriver } from 'edgedriver'
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const isWindows = process.platform === 'win32'
const root = resolve(import.meta.dirname, '..')
const application = join(root, 'src-tauri', 'target', 'debug', isWindows ? 'flint.exe' : 'flint')
/** Linux only: Windows attaches msedgedriver to the app directly. */
const tauriDriver = process.env.TAURI_DRIVER ?? join(homedir(), '.cargo', 'bin', 'tauri-driver')

const DRIVER_PORT = 4444
/** On Windows the driver attaches to the app's WebView2 through this port. */
const DEBUGGING_PORT = 9333

const sandbox = (process.env.FLINT_E2E_SANDBOX ??= mkdtempSync(join(tmpdir(), 'flint-e2e-')))
/** Each Windows session's own WebView2 data, so it doesn't join another Flint's browser process. */
const webViewFolder = (vault: string) => `${vault}-webview`
let driver: ChildProcess | undefined
let app: ChildProcess | undefined
let restoreAppData: (() => void) | undefined

const isPortOpen = (port: number) =>
  new Promise<boolean>((resolvePort) => {
    const socket = connect(port, '127.0.0.1')
    socket.once('connect', () => resolvePort(socket.end() && true))
    socket.once('error', () => resolvePort(false))
  })

async function waitFor(isReady: () => Promise<boolean>, timeoutMessage: string, attempts = 100) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (await isReady()) return
    await new Promise((wait) => setTimeout(wait, 200))
  }
  throw new Error(timeoutMessage)
}

const hasPage = async () => {
  try {
    const targets = await fetch(`http://127.0.0.1:${DEBUGGING_PORT}/json/list`)
    return ((await targets.json()) as { type: string }[]).some(({ type }) => type === 'page')
  } catch {
    return false
  }
}

/** The installed WebView2 runtime's version, which the driver has to match (Edge's may differ). */
function webView2Version() {
  const client = 'Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
  for (const key of [`HKLM\\SOFTWARE\\WOW6432Node\\${client}`, `HKCU\\Software\\${client}`]) {
    try {
      const output = execFileSync('reg', ['query', key, '/v', 'pv'], { encoding: 'utf8' })
      const version = output.match(/pv\s+REG_SZ\s+([\d.]+)/)?.[1]
      if (version && version !== '0.0.0.0') return version
    } catch {
      // not installed for this scope
    }
  }
  throw new Error('the WebView2 runtime is not installed')
}

/**
 * On Windows, Flint keeps its settings and note history in %APPDATA%, which the tests can't
 * redirect: they start from default settings and put everything back when they finish.
 * The settings wait in backup files, so a run that was cut short is undone by the next one.
 */
function isolateAppData() {
  const { identifier } = JSON.parse(
    readFileSync(join(root, 'src-tauri', 'tauri.conf.json'), 'utf8'),
  ) as { identifier: string }
  const folder = join(process.env.APPDATA ?? '', identifier)
  const files = ['settings.json', '.window-state.json'].map((name) => join(folder, name))
  const backup = (path: string) => `${path}.e2e-backup`
  for (const path of files) {
    if (existsSync(path) && !existsSync(backup(path))) renameSync(path, backup(path))
    else rmSync(path, { force: true })
  }
  const history = join(folder, 'history')
  const historyFolders = () => (existsSync(history) ? readdirSync(history) : [])
  const kept = new Set(historyFolders())
  return () => {
    for (const path of files) {
      if (existsSync(backup(path))) renameSync(backup(path), path)
      else rmSync(path, { force: true })
    }
    for (const name of historyFolders()) {
      if (!kept.has(name)) rmSync(join(history, name), { recursive: true, force: true })
    }
  }
}

export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: ['./specs/**/*.e2e.ts'],
  maxInstances: 1,
  hostname: '127.0.0.1',
  port: DRIVER_PORT,
  capabilities: [
    isWindows
      ? // BiDi would replace the app's page with a blank one
        ({ 'wdio:enforceWebDriverClassic': true } as WebdriverIO.Capabilities)
      : ({ 'tauri:options': { application } } as WebdriverIO.Capabilities),
  ],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: { ui: 'bdd', timeout: 60_000 },
  waitforTimeout: 10_000,
  logLevel: 'warn',

  async beforeSession(_config, capabilities) {
    const vault = mkdtempSync(join(sandbox, 'vault-'))
    cpSync(join(root, 'e2e', 'fixtures', 'vault'), vault, { recursive: true })
    process.env.FLINT_E2E_VAULT = vault
    if (!isWindows) {
      const options = (capabilities as Record<string, { args?: string[] }>)['tauri:options']
      options.args = [vault]
      return
    }
    // msedgedriver can't start the app itself ("DevToolsActivePort file doesn't exist"),
    // so the app starts with a debugging port and the driver attaches to it.
    app = spawn(application, [vault], {
      stdio: 'ignore',
      env: {
        ...process.env,
        WEBVIEW2_USER_DATA_FOLDER: webViewFolder(vault),
        WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${DEBUGGING_PORT}`,
      },
    })
    await waitFor(hasPage, `Flint's window did not open on port ${DEBUGGING_PORT}`)
    Object.assign(capabilities, {
      'ms:edgeOptions': { debuggerAddress: `127.0.0.1:${DEBUGGING_PORT}` },
    })
  },

  async afterSession() {
    if (!app) return
    app.kill()
    // WebView2's processes outlive the app for a moment; once its folder can go, they're gone.
    const webView = webViewFolder(process.env.FLINT_E2E_VAULT ?? '')
    await waitFor(async () => {
      try {
        rmSync(webView, { recursive: true, force: true })
        return true
      } catch {
        return false
      }
    }, `Flint's WebView2 processes kept running`)
  },

  async onPrepare() {
    if (isWindows) {
      const version = webView2Version()
      const nativeDriver =
        process.env.NATIVE_DRIVER ??
        (await downloadEdgeDriver(version, join(tmpdir(), `msedgedriver-${version}`)))
      driver = spawn(nativeDriver, [`--port=${DRIVER_PORT}`], { stdio: 'ignore' })
      restoreAppData = isolateAppData()
    } else {
      const nativeDriver = process.env.NATIVE_DRIVER
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
    }
    await waitFor(() => isPortOpen(DRIVER_PORT), `the driver did not start on port ${DRIVER_PORT}`)
  },

  onComplete() {
    driver?.kill()
    restoreAppData?.()
    rmSync(sandbox, { recursive: true, force: true, maxRetries: 10 })
  },
}
