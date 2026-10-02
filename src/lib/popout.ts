import type { TabView } from './layout'

const param = new URLSearchParams(location.search).get('popout')

/** The view this window was popped out with; null in the main window. */
export const popoutView: TabView | null = param ? (JSON.parse(param) as TabView) : null

export const isPopout = popoutView !== null
