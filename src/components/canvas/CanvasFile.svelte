<script lang="ts">
  import { SvelteFlowProvider } from '@xyflow/svelte'
  import { vaultChanged } from '../../lib/events'
  import * as vault from '../../lib/vault'
  import { workspace } from '../../lib/workspace.svelte'
  import CanvasView from './CanvasView.svelte'

  const SAVE_DELAY_MS = 400

  let { path, embedded = false }: { path: string; embedded?: boolean } = $props()

  let source = $state<string | null>(null)
  let saveTimer: ReturnType<typeof setTimeout> | undefined

  $effect(() => {
    let isCurrent = true
    const load = () =>
      vault.readNote(path).then(
        (contents) => {
          if (isCurrent && !saveTimer) source = contents
        },
        (error: unknown) => workspace.notify(String(error)),
      )
    void load()
    const unsubscribe = vaultChanged.on((paths) => {
      if (paths.includes(path)) void load()
    })
    return () => {
      isCurrent = false
      unsubscribe()
      flush()
    }
  })

  function flush() {
    if (!saveTimer || source === null) return
    clearTimeout(saveTimer)
    saveTimer = undefined
    vault.writeNote(path, source).catch((error: unknown) => workspace.notify(String(error)))
  }

  function save(next: string) {
    source = next
    clearTimeout(saveTimer)
    saveTimer = setTimeout(flush, SAVE_DELAY_MS)
  }
</script>

{#if source !== null}
  <SvelteFlowProvider>
    <CanvasView {path} {source} onchange={save} {embedded} />
  </SvelteFlowProvider>
{/if}
