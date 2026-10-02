import { EditorView } from '@codemirror/view'
import { pasteFromClipboard } from './editor/attachments'
import * as vault from './vault'

type TextField = HTMLInputElement | HTMLTextAreaElement

export interface Misspelling {
  word: string
  replace: (text: string) => void
}

export interface EditMenuState {
  x: number
  y: number
  isLink: boolean
  isEditable: boolean
  /** What was selected when the menu opened. */
  selection: string
  editor: EditorView | null
  field: TextField | null
  misspelling: Misspelling | null
}

const isTextField = (element: Element | null): element is TextField =>
  element instanceof HTMLTextAreaElement ||
  (element instanceof HTMLInputElement && !['checkbox', 'radio', 'range'].includes(element.type))

function replaceInField(field: TextField, text: string) {
  field.setRangeText(text, field.selectionStart ?? 0, field.selectionEnd ?? 0, 'end')
  field.dispatchEvent(new Event('input', { bubbles: true }))
  field.focus()
}

/** Flint's own context menu for notes and text fields, the same on every platform. */
class EditMenu {
  state = $state<EditMenuState | null>(null)
  /** A misspelled word under the pointer, left by the spell checker for the next menu. */
  misspelling: Misspelling | null = null

  /** Opens the menu for a right-click inside notes or text fields; false anywhere else. */
  open(event: MouseEvent) {
    const target = event.target as Element
    const field = isTextField(target) ? target : null
    const editorElement = target.closest<HTMLElement>('.cm-editor')
    const isInside = field || editorElement || target.closest('.markdown')
    const misspelling = this.misspelling
    this.misspelling = null
    if (!isInside) return false
    const editor = !field && editorElement ? EditorView.findFromDOM(editorElement) : null
    const selection = field
      ? field.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? 0)
      : editor
        ? editor.state.sliceDoc(editor.state.selection.main.from, editor.state.selection.main.to)
        : (window.getSelection()?.toString() ?? '')
    this.state = {
      x: event.clientX,
      y: event.clientY,
      isLink: target.closest('a, [data-link], [data-url]') !== null,
      isEditable: field !== null || target.closest('.cm-content') !== null,
      selection,
      editor,
      field: field && !field.readOnly ? field : null,
      misspelling,
    }
    return true
  }

  /** Closes the menu, giving the focus back to what it acted on. */
  close() {
    const state = this.state
    this.state = null
    if (state?.field?.isConnected) state.field.focus()
    else state?.editor?.focus()
  }

  async copy() {
    if (this.state?.selection) await vault.setClipboardText(this.state.selection)
  }

  async cut() {
    const state = this.state
    if (!state?.selection) return
    await vault.setClipboardText(state.selection)
    if (state.field) replaceInField(state.field, '')
    else state.editor?.dispatch(state.editor.state.replaceSelection(''))
  }

  async paste() {
    const state = this.state
    if (state?.field) replaceInField(state.field, await vault.clipboardText())
    else if (state?.editor) await pasteFromClipboard(state.editor)
  }
}

export const editMenu = new EditMenu()
