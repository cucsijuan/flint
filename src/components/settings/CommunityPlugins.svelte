<script lang="ts">
  import { ArrowLeft, ExternalLink } from '@lucide/svelte'
  import { onMount } from 'svelte'
  import { SvelteMap } from 'svelte/reactivity'
  import { pluginHost } from '../../lib/plugins/host.svelte'
  import * as vault from '../../lib/vault'
  import type { CommunityPlugin } from '../../lib/vault'
  import { workspace } from '../../lib/workspace.svelte'

  const REGISTRY = 'https://github.com/cucsijuan/flint-plugins'

  let { onBack }: { onBack: () => void } = $props()

  let plugins = $state<CommunityPlugin[] | null>(null)
  let error = $state<string | null>(null)
  let search = $state('')
  let installing = $state<string | null>(null)
  const latest = new SvelteMap<string, string>()

  const installed = $derived(
    new Map(
      pluginHost.plugins.flatMap((plugin) =>
        plugin.manifest ? [[plugin.manifest.id, plugin.manifest.version] as const] : [],
      ),
    ),
  )
  const shown = $derived(
    (plugins ?? []).filter((plugin) =>
      `${plugin.name} ${plugin.author} ${plugin.description}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
    ),
  )

  onMount(async () => {
    try {
      plugins = await vault.communityPlugins()
      const mine = plugins.filter((plugin) => installed.has(plugin.id))
      const versions = await vault.latestPluginVersions(mine)
      mine.forEach((plugin, index) => {
        const version = versions[index]
        if (version) latest.set(plugin.id, version)
      })
    } catch (reason) {
      error = String(reason)
    }
  })

  async function install(plugin: CommunityPlugin) {
    installing = plugin.id
    try {
      const manifest = await vault.installPlugin(plugin)
      latest.set(plugin.id, manifest.version)
      await pluginHost.reload([manifest.id])
      workspace.notify(`Installed ${manifest.name} ${manifest.version}.`)
    } catch (reason) {
      workspace.notify(`Couldn't install ${plugin.name}: ${String(reason)}`)
    } finally {
      installing = null
    }
  }

  function action(plugin: CommunityPlugin) {
    const version = installed.get(plugin.id)
    const newest = latest.get(plugin.id)
    if (version === undefined) return 'Install'
    return newest && newest !== version ? `Update to ${newest}` : null
  }
</script>

<header>
  <button class="icon" title="Back to installed plugins" onclick={onBack}>
    <ArrowLeft size={16} />
  </button>
  <input type="search" placeholder="Search community plugins…" bind:value={search} />
</header>

{#if error}
  <p class="message error">Couldn't load the plugin list: {error}</p>
{:else if plugins === null}
  <p class="message">Loading…</p>
{:else if plugins.length === 0}
  <p class="message">
    No community plugins yet. Share yours by adding it to
    <button class="link" onclick={() => workspace.openUrl(REGISTRY)}>flint-plugins</button>.
  </p>
{:else}
  <ul>
    {#each shown as plugin (plugin.id)}
      {@const label = action(plugin)}
      <li>
        <span class="text">
          <strong>{plugin.name}</strong>
          <small>
            {plugin.author}
            <button
              class="link"
              title="Open its repository"
              onclick={() => workspace.openUrl(`https://github.com/${plugin.repo}`)}
            >
              {plugin.repo}
              <ExternalLink size={11} />
            </button>
          </small>
          {#if plugin.description}<small>{plugin.description}</small>{/if}
        </span>
        {#if label}
          <button class="install" disabled={installing !== null} onclick={() => install(plugin)}>
            {installing === plugin.id ? 'Installing…' : label}
          </button>
        {:else}
          <span class="done">Installed</span>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }

  input {
    flex: 1;
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--background-secondary);
    color: var(--text);
    font: inherit;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 0;
    border-bottom: 1px solid var(--border);
  }

  .text {
    display: grid;
    gap: 3px;
  }

  small,
  .message {
    color: var(--text-muted);
  }

  .error {
    color: #d04545;
  }

  .link {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 0;
    border: none;
    background: none;
    color: var(--accent);
    font: inherit;
    cursor: pointer;
  }

  .install {
    flex-shrink: 0;
    padding: 5px 12px;
    border: none;
    border-radius: 4px;
    background: var(--accent);
    color: white;
    font: inherit;
    cursor: pointer;
  }

  .install:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .done {
    color: var(--text-faint);
    font-size: 12px;
  }
</style>
