import { Facet } from '@codemirror/state'
import type { HydrateContext } from '../render/hydrate'

export type PreviewContext = Omit<HydrateContext, 'depth'>

export const previewContext = Facet.define<PreviewContext, PreviewContext | null>({
  combine: (values) => values[0] ?? null,
})
