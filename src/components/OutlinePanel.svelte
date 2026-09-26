<script lang="ts">
  import { documents } from '../lib/documents'
  import { type OutlineHeading, outlineOf } from '../lib/outline'
  import { workspace } from '../lib/workspace.svelte'

  const UPDATE_DELAY_MS = 150

  let { path }: { path: string } = $props()

  let headings = $state<OutlineHeading[]>([])
  const minLevel = $derived(Math.min(...headings.map((heading) => heading.level)))

  $effect(() => {
    const note = path
    let timer: ReturnType<typeof setTimeout> | undefined
    void documents.load(note).then((text) => (headings = outlineOf(text)))
    const unsubscribe = documents.subscribe(note, (text) => {
      clearTimeout(timer)
      timer = setTimeout(() => (headings = outlineOf(text)), UPDATE_DELAY_MS)
    })
    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  })

  function jump({ text, line }: OutlineHeading) {
    workspace.openNoteAt(path, workspace.activeTab.isReading ? { heading: text } : { line })
  }
</script>

<aside>
  <header>Outline</header>
  {#if headings.length === 0}
    <p class="empty">No headings in this note.</p>
  {:else}
    <ul>
      {#each headings as heading (heading.line)}
        <li style:padding-left="{(heading.level - minLevel) * 14}px">
          <button onclick={() => jump(heading)}>{heading.text}</button>
        </li>
      {/each}
    </ul>
  {/if}
</aside>

<style>
  aside {
    height: 100%;
    overflow: auto;
    background: var(--background-secondary);
  }

  header {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
    font-size: 13px;
    font-weight: 600;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 6px;
  }

  button {
    width: 100%;
    padding: 3px 6px;
    overflow: hidden;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--text);
    font: inherit;
    font-size: 13px;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }

  button:hover {
    background: var(--hover);
  }

  .empty {
    margin: 0;
    padding: 12px;
    color: var(--text-muted);
    font-size: 12px;
  }
</style>
