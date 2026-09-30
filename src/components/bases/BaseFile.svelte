<script lang="ts">
  import { vaultChanged } from '../../lib/events'
  import * as vault from '../../lib/vault'
  import { workspace } from '../../lib/workspace.svelte'
  import BaseView from './BaseView.svelte'

  let { path }: { path: string } = $props()

  let source = $state<string | null>(null)

  $effect(() => {
    let isCurrent = true
    const load = () =>
      vault.readNote(path).then(
        (contents) => {
          if (isCurrent) source = contents
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
    }
  })

  function save(next: string) {
    source = next
    vault.writeNote(path, next).catch((error: unknown) => workspace.notify(String(error)))
  }
</script>

<section>
  {#if source !== null}
    <BaseView {source} onchange={save} currentPath={path} viewKey={path} />
  {/if}
</section>

<style>
  section {
    height: 100%;
    overflow: auto;
    padding: 16px 24px;
  }
</style>
