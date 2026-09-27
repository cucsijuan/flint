<script lang="ts">
  import { RefreshCw } from '@lucide/svelte'
  import { pluginHost } from '../../lib/plugins/host.svelte'
  import { workspace } from '../../lib/workspace.svelte'
  import CommunityPlugins from './CommunityPlugins.svelte'

  let isBrowsing = $state(false)
</script>

{#if isBrowsing}
  <CommunityPlugins onBack={() => (isBrowsing = false)} />
{:else}
  <section>
    <header>
      <span>
        <strong>Plugins</strong>
        <small>Installed in this vault's <code>.flint/plugins</code> folder.</small>
      </span>
      <span class="buttons">
        <button class="browse" onclick={() => (isBrowsing = true)}>Browse community plugins</button>
        <button class="icon" title="Reload plugins" onclick={() => pluginHost.load()}>
          <RefreshCw size={16} />
        </button>
      </span>
    </header>
    <label class="option">
      <span>
        <strong>Reload plugins when their files change</strong>
        <small>For plugin development: saving main.js or styles.css reloads that plugin.</small>
      </span>
      <input
        type="checkbox"
        checked={workspace.settings.value.pluginHotReload}
        onchange={(event) =>
          workspace.setSettings({ pluginHotReload: event.currentTarget.checked })}
      />
    </label>
    {#if pluginHost.plugins.length === 0}
      <p class="empty">No plugins installed.</p>
    {/if}
    <ul>
      {#each pluginHost.plugins as plugin (plugin.folder)}
        {@const manifest = plugin.manifest}
        <li>
          <span>
            <strong>{manifest?.name ?? plugin.folder}</strong>
            {#if manifest}
              <small>{manifest.version}{manifest.author ? ` · ${manifest.author}` : ''}</small>
              {#if manifest.description}<small>{manifest.description}</small>{/if}
              {#if !plugin.hasCompatibleLicense}
                <small class="warning">
                  License "{manifest.license || 'none'}" is not compatible with Flint's AGPL.
                </small>
              {/if}
            {/if}
            {#if plugin.error}<small class="error">{plugin.error}</small>{/if}
          </span>
          <input
            type="checkbox"
            aria-label="Enable {manifest?.name ?? plugin.folder}"
            disabled={!manifest}
            checked={plugin.status === 'on'}
            onchange={(event) => pluginHost.setEnabled(plugin, event.currentTarget.checked)}
          />
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .buttons {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .browse {
    padding: 5px 12px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--background-secondary);
    color: var(--text);
    font: inherit;
    font-size: 12px;
    white-space: nowrap;
    cursor: pointer;
  }

  header,
  .option,
  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .option {
    padding: 10px 0;
    border-bottom: 1px solid var(--border);
  }

  span {
    display: grid;
    gap: 2px;
  }

  small {
    color: var(--text-muted);
  }

  .warning {
    color: #c98a1a;
  }

  .error {
    color: #d04545;
  }

  ul {
    display: grid;
    gap: 12px;
    max-height: 40vh;
    overflow: auto;
    list-style: none;
    margin: 12px 0 0;
    padding: 0;
  }

  input {
    width: 16px;
    height: 16px;
    accent-color: var(--accent);
  }

  .empty {
    color: var(--text-muted);
    font-size: 13px;
  }
</style>
