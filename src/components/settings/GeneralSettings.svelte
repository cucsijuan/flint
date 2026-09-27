<script lang="ts">
  import { workspace } from '../../lib/workspace.svelte'
  import Setting from './Setting.svelte'
</script>

<Setting name="Check for updates" description="Look for a new version of Flint when it starts.">
  <input
    type="checkbox"
    checked={workspace.checkForUpdates}
    onchange={(event) => workspace.setCheckForUpdates(event.currentTarget.checked)}
  />
</Setting>
