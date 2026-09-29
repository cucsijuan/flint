<script lang="ts">
  import { Check } from '@lucide/svelte'
  import { DropdownMenu } from 'bits-ui'
  import { onMount } from 'svelte'
  import * as vault from '../../lib/vault'
  import { workspace } from '../../lib/workspace.svelte'
  import Setting from './Setting.svelte'

  const names = new Intl.DisplayNames(['en'], { type: 'language' })
  const languageName = (dictionary: string) => {
    try {
      return names.of(dictionary.replace('_', '-')) ?? dictionary
    } catch {
      return dictionary
    }
  }

  let dictionaries = $state<string[] | null>(null)
  const chosen = $derived(workspace.settings.value.spellcheckLanguages)
  const summary = $derived(
    chosen.length ? chosen.map(languageName).join(', ') : 'Same as the system',
  )

  onMount(() => {
    void vault.spellingLanguages().then((installed) => (dictionaries = installed))
  })

  function toggle(dictionary: string, isChecked: boolean) {
    const spellcheckLanguages = isChecked
      ? [...chosen, dictionary].sort()
      : chosen.filter((language) => language !== dictionary)
    workspace.setSettings({ spellcheckLanguages })
  }
</script>

{#if dictionaries?.length}
  <Setting
    name="Spell-check languages"
    description="Words are checked against every language picked. Install a Hunspell dictionary to add one."
  >
    <DropdownMenu.Root>
      <DropdownMenu.Trigger class="languages">{summary}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="menu languages-menu" align="end">
          {#each dictionaries as dictionary (dictionary)}
            <DropdownMenu.CheckboxItem
              class="menu-item language"
              closeOnSelect={false}
              checked={chosen.includes(dictionary)}
              onCheckedChange={(isChecked) => toggle(dictionary, isChecked)}
            >
              {#snippet children({ checked })}
                <span class="check"
                  >{#if checked}<Check size={14} />{/if}</span
                >
                {languageName(dictionary)}
              {/snippet}
            </DropdownMenu.CheckboxItem>
          {/each}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  </Setting>
{:else if dictionaries}
  <Setting
    name="Spell-check languages"
    description="Spelling is checked in the languages set in your system's settings."
  >
    <span></span>
  </Setting>
{/if}

<style>
  :global(.languages) {
    max-width: 240px;
    overflow: hidden;
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--background-secondary);
    color: var(--text);
    font: inherit;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }

  :global(.languages-menu) {
    max-height: 320px;
    overflow-y: auto;
  }

  :global(.language) {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .check {
    display: inline-flex;
    width: 14px;
  }
</style>
