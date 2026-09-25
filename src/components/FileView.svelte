<script lang="ts">
  import { basename } from '../lib/paths'
  import { workspace } from '../lib/workspace.svelte'

  let { path }: { path: string } = $props()
</script>

<figure>
  <img src={workspace.assetUrl(path)} alt={basename(path)} />
  <figcaption>{path}</figcaption>
</figure>

<style>
  figure {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 100%;
    margin: 0;
    padding: 24px;
    overflow: auto;
  }

  img {
    max-width: 100%;
    max-height: calc(100% - 32px);
    object-fit: contain;
  }

  figcaption {
    color: var(--text-faint);
    font-size: 12px;
  }
</style>
