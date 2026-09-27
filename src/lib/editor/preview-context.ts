import { Facet } from '@codemirror/state'
import type { HydrateContext } from '../render/hydrate'
import type { PropertiesDisplay } from '../settings'

export type PreviewContext = Omit<HydrateContext, 'depth'>

export const previewContext = Facet.define<PreviewContext, PreviewContext | null>({
  combine: (values) => values[0] ?? null,
})

export const propertiesDisplay = Facet.define<PropertiesDisplay, PropertiesDisplay>({
  combine: (values) => values[0] ?? 'visible',
})
