import { activeView } from './editor/active'
import * as vault from './vault'
import { workspace } from './workspace.svelte'

/** Formats to record in, best first, with the extension each recording gets. */
const FORMATS: [string, string][] = [
  ['audio/ogg;codecs=opus', 'ogg'],
  ['audio/mp4', 'm4a'],
  ['audio/webm;codecs=opus', 'weba'],
  ['audio/webm', 'weba'],
]

const timestamp = () => new Date().toISOString().replace(/\D/g, '').slice(0, 14)

/** Records from the microphone and embeds the recording in the note being edited. */
class Recorder {
  startedAt = $state<number | null>(null)
  #recorder: MediaRecorder | null = null

  get isRecording() {
    return this.startedAt !== null
  }

  async start() {
    const note = workspace.notePath
    if (!note || this.#recorder) return
    const format = FORMATS.find(([type]) => MediaRecorder.isTypeSupported(type))
    if (!format) {
      workspace.notify("This system can't record audio.")
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (error) {
      workspace.notify(`Couldn't use the microphone: ${String(error)}`)
      return
    }
    const [type, extension] = format
    const recorder = new MediaRecorder(stream, { mimeType: type })
    const chunks: Blob[] = []
    recorder.ondataavailable = (event) => chunks.push(event.data)
    recorder.onstop = () => {
      for (const track of stream.getTracks()) track.stop()
      void this.#save(new Blob(chunks, { type }), extension, note)
    }
    recorder.start()
    this.#recorder = recorder
    this.startedAt = Date.now()
  }

  stop() {
    this.#recorder?.stop()
    this.#recorder = null
    this.startedAt = null
  }

  toggle() {
    if (this.isRecording) this.stop()
    else void this.start()
  }

  async #save(blob: Blob, extension: string, note: string) {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const link = await workspace.saveAttachment(
      {
        name: `Recording ${timestamp()}.${extension}`,
        write: async (path) => {
          await vault.saveAttachment(path, bytes)
          return true
        },
      },
      note,
    )
    if (!link) return
    const embed = `![[${link}]]`
    const view = activeView()
    if (view && workspace.notePath === note) {
      view.dispatch(view.state.replaceSelection(embed))
    } else {
      workspace.notify(`Saved the recording as ${link}.`)
    }
  }
}

export const recorder = new Recorder()
