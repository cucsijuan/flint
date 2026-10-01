<script lang="ts">
  import { Check, Download } from '@lucide/svelte'
  import { DropdownMenu } from 'bits-ui'
  import { onMount } from 'svelte'
  import { dictionaryFor } from '../../lib/spelling.svelte'
  import * as vault from '../../lib/vault'
  import { workspace } from '../../lib/workspace.svelte'
  import Setting from './Setting.svelte'

  const names = new Intl.DisplayNames(['en'], { type: 'language' })
  const languageName = (code: string) => {
    try {
      return names.of(code) ?? code
    } catch {
      return code
    }
  }

  let languages = $state<vault.SpellingLanguage[]>([])
  const settings = $derived(workspace.settings.value)
  const codes = $derived(languages.map((language) => language.code))
  const chosen = $derived(
    settings.spellcheckLanguages.flatMap((name) => dictionaryFor(name, codes) ?? []),
  )
  const systemLanguage = $derived(dictionaryFor(navigator.language, codes))
  const summary = $derived(
    chosen.length
      ? chosen.map(languageName).join(', ')
      : `Same as the system${systemLanguage ? ` (${languageName(systemLanguage)})` : ''}`,
  )
  const sorted = $derived(
    [...languages].sort((a, b) => languageName(a.code).localeCompare(languageName(b.code))),
  )

  onMount(() => {
    void vault.spellingLanguages().then((found) => (languages = found))
  })

  function toggle(code: string, isChecked: boolean) {
    const spellcheckLanguages = isChecked
      ? [...chosen, code]
      : chosen.filter((language) => language !== code)
    workspace.setSettings({ spellcheckLanguages })
  }
</script>

<Setting
  name="Spell check"
  description="Underline misspelled words; right-click one for suggestions."
>
  <input
    type="checkbox"
    checked={settings.spellcheck}
    onchange={(event) => workspace.setSettings({ spellcheck: event.currentTarget.checked })}
  />
</Setting>
{#if settings.spellcheck && languages.length}
  <Setting
    name="Spell-check languages"
    description="Words are checked against every language picked. Dictionaries download the first time they're used."
  >
    <DropdownMenu.Root>
      <DropdownMenu.Trigger class="languages">{summary}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="menu languages-menu" align="end">
          {#each sorted as language (language.code)}
            <DropdownMenu.CheckboxItem
              class="menu-item language"
              closeOnSelect={false}
              checked={chosen.includes(language.code)}
              onCheckedChange={(isChecked) => toggle(language.code, isChecked)}
            >
              {#snippet children({ checked })}
                <span class="check"
                  >{#if checked}<Check size={14} />{/if}</span
                >
                <span class="name">{languageName(language.code)}</span>
                {#if !language.installed}
                  <span class="download" title="Downloads when picked"><Download size={12} /></span>
                {/if}
              {/snippet}
            </DropdownMenu.CheckboxItem>
          {/each}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
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

  .name {
    flex: 1;
  }

  .download {
    display: inline-flex;
    color: var(--text-faint);
  }
</style>
