import { StateEffect, StateField, type Transaction } from '@codemirror/state'
import { EditorView, ViewPlugin } from '@codemirror/view'

const setPointerDown = StateEffect.define<boolean>()

export const pointerDown = StateField.define<boolean>({
  create: () => false,
  update: (isDown, transaction) =>
    transaction.effects.reduce(
      (value, effect) => (effect.is(setPointerDown) ? effect.value : value),
      isDown,
    ),
})

export const pointerReleased = (transaction: Transaction) =>
  transaction.startState.field(pointerDown, false) && !transaction.state.field(pointerDown, false)

/** Live preview keeps its layout while the mouse is pressed, so the click doesn't turn into a selection. */
const pointerTracking = ViewPlugin.define(
  (view) => {
    const release = () => {
      if (!view.state.field(pointerDown)) return
      view.dispatch({
        effects: [
          setPointerDown.of(false),
          EditorView.scrollIntoView(view.state.selection.main.head),
        ],
      })
    }
    const clickMargin = (event: MouseEvent) => {
      if (event.button !== 0 || event.target !== view.scrollDOM) return
      const content = view.contentDOM.getBoundingClientRect()
      if (event.clientY > content.bottom) return
      const x = Math.min(Math.max(event.clientX, content.left + 1), content.right - 1)
      const position = view.posAtCoords({ x, y: event.clientY })
      if (position === null) return
      event.preventDefault()
      view.dispatch({ selection: { anchor: position }, effects: setPointerDown.of(true) })
      view.focus()
    }
    document.addEventListener('mouseup', release)
    view.scrollDOM.addEventListener('mousedown', clickMargin)
    return {
      destroy: () => {
        document.removeEventListener('mouseup', release)
        view.scrollDOM.removeEventListener('mousedown', clickMargin)
      },
    }
  },
  {
    eventHandlers: {
      mousedown(event, view) {
        if (event.button === 0) view.dispatch({ effects: setPointerDown.of(true) })
      },
    },
  },
)

export const pointer = [pointerDown, pointerTracking]
