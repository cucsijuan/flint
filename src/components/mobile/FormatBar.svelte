<script lang="ts">
  import { indentLess, indentMore, redo, undo } from '@codemirror/commands'
  import type { EditorView } from '@codemirror/view'
  import {
    Bold,
    Code,
    Heading,
    IndentDecrease,
    IndentIncrease,
    Italic,
    Keyboard,
    Link,
    List,
    ListTodo,
    Redo2,
    Slash,
    Strikethrough,
    Undo2,
  } from '@lucide/svelte'
  import { commands } from '../../lib/commands.svelte'
  import { activeView } from '../../lib/editor/active'
  import { toggleLinePrefix } from '../../lib/editor/formatting'

  let isEditing = $state(false)

  const onFocusChange = () => {
    isEditing = document.activeElement?.closest('.cm-content') != null
  }

  function withView(action: (view: EditorView) => void) {
    return () => {
      const view = activeView()
      if (view) action(view)
    }
  }

  const buttons = [
    { title: 'Undo', icon: Undo2, run: withView((view) => undo(view)) },
    { title: 'Redo', icon: Redo2, run: withView((view) => redo(view)) },
    { title: 'Bold', icon: Bold, run: () => commands.run('toggle-bold') },
    { title: 'Italic', icon: Italic, run: () => commands.run('toggle-italic') },
    {
      title: 'Strikethrough',
      icon: Strikethrough,
      run: () => commands.run('toggle-strikethrough'),
    },
    { title: 'Code', icon: Code, run: () => commands.run('toggle-inline-code') },
    { title: 'Link', icon: Link, run: () => commands.run('insert-link') },
    { title: 'Heading', icon: Heading, run: withView((view) => toggleLinePrefix(view, '# ')) },
    { title: 'List', icon: List, run: withView((view) => toggleLinePrefix(view, '- ')) },
    { title: 'Task', icon: ListTodo, run: withView((view) => toggleLinePrefix(view, '- [ ] ')) },
    { title: 'Indent', icon: IndentIncrease, run: withView((view) => indentMore(view)) },
    { title: 'Outdent', icon: IndentDecrease, run: withView((view) => indentLess(view)) },
    {
      title: 'Commands',
      icon: Slash,
      run: withView((view) => view.dispatch(view.state.replaceSelection('/'))),
    },
    {
      title: 'Hide keyboard',
      icon: Keyboard,
      run: () => (document.activeElement as HTMLElement | null)?.blur(),
    },
  ]
</script>

<svelte:document onfocusin={onFocusChange} onfocusout={() => setTimeout(onFocusChange)} />

{#if isEditing}
  <!-- Buttons keep the editor focused, so the keyboard stays open. -->
  <div
    class="format-bar"
    role="toolbar"
    tabindex="-1"
    onpointerdown={(event) => event.preventDefault()}
  >
    {#each buttons as button (button.title)}
      <button title={button.title} onclick={button.run}><button.icon size={20} /></button>
    {/each}
  </div>
{/if}

<style>
  .format-bar {
    display: flex;
    flex-shrink: 0;
    gap: 2px;
    padding: 4px 6px;
    overflow-x: auto;
    border-top: 1px solid var(--border);
    background: var(--background-secondary);
    scrollbar-width: none;
  }

  button {
    display: grid;
    flex-shrink: 0;
    width: 42px;
    height: 40px;
    place-items: center;
    border: none;
    border-radius: 8px;
    background: none;
    color: var(--text-muted);
  }

  button:active {
    background: var(--hover);
    color: var(--text);
  }
</style>
