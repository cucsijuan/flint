<script lang="ts">
  import { RefreshCw } from '@lucide/svelte'
  import { pluginHost } from '../lib/plugins/host.svelte'
</script>

<section>
  <header>
    <span>
      <strong>Plugins</strong>
      <small>Installed in this vault's <code>.flint/plugins</code> folder.</small>
    </span>
    <button class="icon" title="Reload plugins" onclick={() => pluginHost.load()}>
      <RefreshCw size={16} />
    </button>
  </header>
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

<style>
  section {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  header,
  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
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
