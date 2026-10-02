import { describe, expect, it } from 'vitest'
import { encodeWav } from './wav'

describe('encodeWav', () => {
  it('writes a PCM header and the samples', () => {
    const left = new Float32Array([0, 1, -1])
    const bytes = encodeWav({
      numberOfChannels: 1,
      sampleRate: 8000,
      length: 3,
      getChannelData: () => left,
    })
    const view = new DataView(bytes.buffer)
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('RIFF')
    expect(view.getUint32(24, true)).toBe(8000)
    expect(view.getUint32(40, true)).toBe(6)
    expect([view.getInt16(44, true), view.getInt16(46, true), view.getInt16(48, true)]).toEqual([
      0, 32767, -32768,
    ])
  })
})
