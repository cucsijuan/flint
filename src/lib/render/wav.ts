/** The parts of an AudioBuffer a WAV file needs. */
export interface Samples {
  numberOfChannels: number
  sampleRate: number
  length: number
  getChannelData: (channel: number) => Float32Array
}

/** 16-bit PCM WAV bytes for decoded audio: a format every player knows the length of. */
export function encodeWav(samples: Samples) {
  const { numberOfChannels: channels, sampleRate, length } = samples
  const dataSize = length * channels * 2
  const view = new DataView(new ArrayBuffer(44 + dataSize))
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i))
  }
  text(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * channels * 2, true)
  view.setUint16(32, channels * 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, dataSize, true)
  const data = Array.from({ length: channels }, (_, channel) => samples.getChannelData(channel))
  let offset = 44
  for (let i = 0; i < length; i++) {
    for (const channel of data) {
      const sample = Math.max(-1, Math.min(1, channel[i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }
  return new Uint8Array(view.buffer)
}
