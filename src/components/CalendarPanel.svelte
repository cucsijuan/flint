<script lang="ts">
  import { ChevronLeft, ChevronRight } from '@lucide/svelte'
  import { dailyNoteDate, dayjs, localFirstDay, monthGrid } from '../lib/dates'
  import { workspace } from '../lib/workspace.svelte'

  const firstDay = localFirstDay()
  let month = $state(dayjs().startOf('month'))

  const weeks = $derived(monthGrid(month, firstDay))
  const weekdays = $derived(
    weeks[0].map((day) => day.toDate().toLocaleDateString(undefined, { weekday: 'narrow' })),
  )
  const monthName = $derived(
    month.toDate().toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
  )
  const noteDays = $derived(
    new Set(
      workspace.entries.flatMap((entry) => {
        const date = dailyNoteDate(entry.path, workspace.dailyNotes)
        return date ? [date.format('YYYY-MM-DD')] : []
      }),
    ),
  )
  const openDay = $derived(
    workspace.notePath ? dailyNoteDate(workspace.notePath, workspace.dailyNotes) : null,
  )
  const today = $derived(dayjs().format('YYYY-MM-DD'))
</script>

<section>
  <header>
    <strong>{monthName}</strong>
    <button
      class="icon"
      title="Previous month"
      onclick={() => (month = month.subtract(1, 'month'))}
    >
      <ChevronLeft size={16} />
    </button>
    <button class="today" onclick={() => (month = dayjs().startOf('month'))}>Today</button>
    <button class="icon" title="Next month" onclick={() => (month = month.add(1, 'month'))}>
      <ChevronRight size={16} />
    </button>
  </header>
  <table>
    <thead>
      <tr>
        {#each weekdays as weekday, index (index)}<th>{weekday}</th>{/each}
      </tr>
    </thead>
    <tbody>
      {#each weeks as week (week[0].valueOf())}
        <tr>
          {#each week as day (day.valueOf())}
            {@const key = day.format('YYYY-MM-DD')}
            <td>
              <button
                class:other={!day.isSame(month, 'month')}
                class:today={key === today}
                class:open={openDay?.isSame(day, 'day')}
                title={noteDays.has(key) ? `Open ${key}` : `Create ${key}`}
                onclick={(event) =>
                  workspace.openDailyNoteFor(day, { newTab: event.ctrlKey || event.metaKey })}
              >
                {day.date()}
                <span class="dot" class:shown={noteDays.has(key)}></span>
              </button>
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</section>

<style>
  section {
    height: 100%;
    overflow: auto;
    padding: 10px;
  }

  header {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 8px;
  }

  strong {
    flex: 1;
    font-size: 14px;
    text-transform: capitalize;
  }

  .today {
    padding: 2px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: none;
    color: var(--text-muted);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  th {
    padding-bottom: 4px;
    color: var(--text-faint);
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
  }

  td {
    padding: 1px;
  }

  td button {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    padding: 4px 0 3px;
    border: none;
    border-radius: 6px;
    background: none;
    color: var(--text);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }

  td button:hover {
    background: var(--hover);
  }

  td button.other {
    color: var(--text-faint);
  }

  td button.today {
    color: var(--accent);
    font-weight: 600;
  }

  td button.open {
    background: var(--selected);
  }

  .dot {
    width: 4px;
    height: 4px;
    margin-top: 2px;
    border-radius: 50%;
  }

  .dot.shown {
    background: var(--text-muted);
  }
</style>
