<script lang="ts" generics="T extends string">
  let {
    value,
    options,
    onchange,
  }: { value: T; options: { value: T; label: string }[]; onchange: (value: T) => void } = $props()
</script>

<select {value} onchange={(event) => onchange(event.currentTarget.value as T)}>
  {#each options as option (option.value)}
    <option value={option.value}>{option.label}</option>
  {/each}
</select>
