<script lang="ts">
  import { documents } from '../../lib/documents'
  import { workspace } from '../../lib/workspace.svelte'
  import BaseView from './BaseView.svelte'

  let { path }: { path: string } = $props()

  let source = $state<string | null>(null)

  $effect(() => {
    let isCurrent = true
    void documents.load(path).then(
      (contents) => {
        if (isCurrent) source = contents
      },
      (error: unknown) => workspace.notify(String(error)),
    )
    const unsubscribe = documents.subscribe(path, (contents) => (source = contents))
    return () => {
      isCurrent = false
      unsubscribe()
    }
  })

  function save(next: string) {
    source = next
    void documents.update(path, () => next)
  }
</script>

<section>
  {#if source !== null}
    <BaseView {source} onchange={save} currentPath={path} />
  {/if}
</section>

<style>
  section {
    height: 100%;
    overflow: auto;
    padding: 16px 24px;
  }
</style>
