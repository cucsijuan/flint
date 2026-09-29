<script lang="ts">
  import L from 'leaflet'
  import 'leaflet/dist/leaflet.css'
  import { type Context, type QueryResult, valueOf, type ViewConfig } from '../../lib/bases/base'
  import { display, ExpressionError, isList, type Value } from '../../lib/bases/expression'
  import { workspace } from '../../lib/workspace.svelte'

  const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
  const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  const DEFAULT_ZOOM = 2

  let { result, view, context }: { result: QueryResult; view: ViewConfig; context: Context } =
    $props()

  const coordinatesProperty = $derived(
    typeof view.coordinates === 'string' ? view.coordinates : null,
  )

  function coordinates(value: Value | ExpressionError): [number, number] | null {
    if (value instanceof ExpressionError || value === null) return null
    const parts = isList(value) ? value.map(display) : display(value).split(',')
    const [lat, lng] = parts.map((part) => Number(String(part).trim()))
    const isValid = parts.length === 2 && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    return isValid && !Number.isNaN(lat) && !Number.isNaN(lng) ? [lat, lng] : null
  }

  const markers = $derived.by(() => {
    const property = coordinatesProperty
    if (!property) return []
    return result.groups
      .flatMap((group) => group.rows)
      .flatMap((row) => {
        const point = coordinates(valueOf(row, property, context))
        return point ? [{ path: row.file.path, name: row.file.basename, point }] : []
      })
  })

  let leaflet = $state.raw<{ map: L.Map; layer: L.LayerGroup; element: HTMLElement } | null>(null)

  function map(element: HTMLElement) {
    const instance = L.map(element, { worldCopyJump: true }).setView([20, 0], DEFAULT_ZOOM)
    L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(instance)
    const observer = new ResizeObserver(() => instance.invalidateSize())
    observer.observe(element)
    leaflet = { map: instance, layer: L.layerGroup().addTo(instance), element }
    return () => {
      observer.disconnect()
      instance.remove()
      leaflet = null
    }
  }

  $effect(() => {
    if (!leaflet) return
    const { map: instance, layer, element } = leaflet
    const color = getComputedStyle(element).getPropertyValue('--accent').trim() || '#6d5dd3'
    layer.clearLayers()
    for (const { path, name, point } of markers) {
      const marker = L.circleMarker(point, { radius: 7, color, fillOpacity: 0.8 })
      marker.bindTooltip(name)
      marker.on('click', () => workspace.openNote(path))
      marker.addTo(layer)
    }
    if (markers.length) {
      instance.fitBounds(L.latLngBounds(markers.map(({ point }) => point)), {
        padding: [30, 30],
        maxZoom: 12,
      })
    }
  })
</script>

{#if !coordinatesProperty}
  <p class="hint">
    Pick the property that holds each note's coordinates (like <code>[48.85, 2.35]</code>) in this
    view's settings.
  </p>
{:else}
  <div class="map" {@attach map}></div>
  {#if !markers.length}<p class="hint">No note has coordinates in this property.</p>{/if}
{/if}

<style>
  .map {
    height: 480px;
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  .hint {
    color: var(--text-muted);
    font-size: 13px;
  }
</style>
