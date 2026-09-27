<script lang="ts">
  import { documents } from '../lib/documents'
  import { type Property, readProperties } from '../lib/properties'
  import PropertiesEditor from './PropertiesEditor.svelte'

  let { path }: { path: string } = $props()

  let properties = $state<Property[]>([])

  $effect(() => {
    const note = path
    void documents.load(note).then((text) => (properties = readProperties(text) ?? []))
    return documents.subscribe(note, (text) => (properties = readProperties(text) ?? []))
  })
</script>

<aside>
  <PropertiesEditor {properties} edit={(change) => void documents.update(path, change)} />
</aside>

<style>
  aside {
    height: 100%;
    overflow: auto;
    padding: 10px 12px;
    background: var(--background-secondary);
  }
</style>
