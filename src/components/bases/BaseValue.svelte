<script lang="ts">
  import DOMPurify from 'dompurify'
  import {
    display,
    ExpressionError,
    FileValue,
    isList,
    Link,
    Rendered,
    type Value,
  } from '../../lib/bases/expression'
  import { isExternalUrl } from '../../lib/paths'
  import { workspace } from '../../lib/workspace.svelte'
  import PluginIcon from '../PluginIcon.svelte'
  import BaseValue from './BaseValue.svelte'

  let { value }: { value: Value | ExpressionError } = $props()

  function open(target: string, event: MouseEvent) {
    event.stopPropagation()
    if (isExternalUrl(target)) workspace.openUrl(target)
    else void workspace.openLink(target, '', { newTab: event.ctrlKey || event.metaKey })
  }

  const sanitized = (html: string) => (element: HTMLElement) => {
    element.innerHTML = DOMPurify.sanitize(html)
  }

  const imageSource = (source: string) =>
    isExternalUrl(source) ? source : workspace.assetUrl(source.replace(/^\[\[|\]\]$/g, ''))
</script>

{#if value instanceof ExpressionError}
  <span class="error" title={value.message}>Error</span>
{:else if value === null}
  <!-- empty -->
{:else if typeof value === 'boolean'}
  <input type="checkbox" checked={value} disabled />
{:else if value instanceof Link}
  <button class="link" onclick={(event) => open(value.target, event)}>{display(value)}</button>
{:else if value instanceof FileValue}
  <button class="link" onclick={(event) => open(value.file.path, event)}
    >{value.file.basename}</button
  >
{:else if value instanceof Rendered}
  {#if value.kind === 'html'}
    <span {@attach sanitized(value.source)}></span>
  {:else if value.kind === 'image'}
    <img src={imageSource(value.source)} alt="" />
  {:else}
    <PluginIcon name={value.source} fallback="" />
  {/if}
{:else if isList(value)}
  <span class="list">
    {#each value as item, index (index)}
      <span class="chip"><BaseValue value={item} /></span>
    {/each}
  </span>
{:else}
  {display(value)}
{/if}

<style>
  .error {
    color: #d04545;
    font-size: 12px;
  }

  .link {
    padding: 0;
    border: none;
    background: none;
    color: var(--accent);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .link:hover {
    text-decoration: underline;
  }

  .list {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .chip {
    padding: 0 6px;
    border-radius: 10px;
    background: var(--hover);
  }

  img {
    max-width: 100%;
    max-height: 120px;
  }
</style>
