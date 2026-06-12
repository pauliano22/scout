import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Dataset } from '../data'
import type { Person } from '../types'
import { useAppDispatch, useAppState } from '../state'

const CARNELIAN = '#B31B1B'
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

interface Props {
  ds: Dataset
  filtered: number[]
}

function toGeoJSON(ds: Dataset, indices: number[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: indices.flatMap(i => {
      const p = ds.data.alumni[i]
      if (!p.g) return []
      return [{
        type: 'Feature' as const,
        id: i,
        geometry: { type: 'Point' as const, coordinates: p.g },
        properties: { i },
      }]
    }),
  }
}

function popupCard(ds: Dataset, p: Person): string {
  const sport = p.sp.map(s => ds.data.sports[s]).join(' · ')
  const year = p.y ? ` '${String(p.y).slice(2)}` : ''
  const work = [p.ro, p.co].filter(Boolean).join(' @ ')
  const industry = p.in != null ? ds.data.industries[p.in] : ''
  const meta = [industry, p.lo].filter(Boolean).join(' · ')
  return `
    <div class="popup-card">
      <div class="popup-name">${esc(p.n)}${year}</div>
      <div class="popup-sport">${esc(sport)}</div>
      ${work ? `<div class="popup-work">${esc(work)}</div>` : ''}
      ${meta ? `<div class="popup-meta">${esc(meta)}</div>` : ''}
      <button class="popup-view" data-view-id="${esc(p.id)}">View profile</button>
    </div>`
}

function leavesCard(ds: Dataset, people: Person[], total: number): string {
  const rows = people.map(p => `
    <button class="popup-leaf" data-view-id="${esc(p.id)}">
      <span>${esc(p.n)}${p.y ? ` '${String(p.y).slice(2)}` : ''}</span>
      <span class="popup-leaf-sport">${esc(ds.data.sports[p.sp[0]] ?? '')}</span>
    </button>`).join('')
  const more = total > people.length ? `<div class="popup-more">+${total - people.length} more — zoom or use the list</div>` : ''
  return `<div class="popup-card popup-leaves"><div class="popup-count">${total} alumni here</div>${rows}${more}</div>`
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

export default function MapView({ ds, filtered }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const loadedRef = useRef(false)
  const filteredRef = useRef(filtered)
  filteredRef.current = filtered
  const dispatch = useAppDispatch()
  const { hoveredIndex, selectedId, filters } = useAppState()

  function fitToResults() {
    const map = mapRef.current
    if (!map) return
    const pts = filteredRef.current.map(i => ds.data.alumni[i].g).filter((g): g is [number, number] => !!g)
    if (!pts.length) return
    let minX = 180, minY = 90, maxX = -180, maxY = -90
    for (const [x, y] of pts) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 70, maxZoom: 10, duration: 700 })
  }

  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current!,
      style: STYLE_URL,
      center: [-77, 40],
      zoom: 3.4,
      attributionControl: { compact: true },
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    map.on('load', () => {
      map.addSource('alumni', {
        type: 'geojson',
        data: toGeoJSON(ds, filteredRef.current),
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 46,
      })

      map.addLayer({
        id: 'clusters', type: 'circle', source: 'alumni', filter: ['has', 'point_count'],
        paint: {
          'circle-color': CARNELIAN,
          'circle-opacity': 0.88,
          'circle-radius': ['step', ['get', 'point_count'], 14, 25, 19, 100, 24, 500, 30],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })
      map.addLayer({
        id: 'cluster-count', type: 'symbol', source: 'alumni', filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 12,
        },
        paint: { 'text-color': '#ffffff' },
      })
      map.addLayer({
        id: 'points', type: 'circle', source: 'alumni', filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': CARNELIAN,
          'circle-radius': ['case', ['boolean', ['feature-state', 'hi'], false], 9, 6],
          'circle-stroke-width': ['case', ['boolean', ['feature-state', 'hi'], false], 3, 1.5],
          'circle-stroke-color': '#ffffff',
        },
      })

      map.on('click', 'clusters', async e => {
        const f = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0]
        const src = map.getSource('alumni') as maplibregl.GeoJSONSource
        const clusterId = f.properties!.cluster_id as number
        const count = f.properties!.point_count as number
        const zoom = await src.getClusterExpansionZoom(clusterId)
        const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number]
        if (zoom > 13 || map.getZoom() >= 12.5) {
          // Co-located points never split apart — list them instead of zooming forever
          const leaves = (await src.getClusterLeaves(clusterId, 12, 0)) as GeoJSON.Feature[]
          const people = leaves.map(l => ds.data.alumni[(l.properties as { i: number }).i])
          openPopup(coords, leavesCard(ds, people, count))
        } else {
          map.easeTo({ center: coords, zoom })
        }
      })

      map.on('click', 'points', e => {
        const f = e.features?.[0]
        if (!f) return
        const p = ds.data.alumni[(f.properties as { i: number }).i]
        openPopup((f.geometry as GeoJSON.Point).coordinates as [number, number], popupCard(ds, p))
      })

      for (const layer of ['clusters', 'points']) {
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = '' })
      }

      loadedRef.current = true
    })

    function openPopup(coords: [number, number], html: string) {
      popupRef.current?.remove()
      const node = document.createElement('div')
      node.innerHTML = html
      node.addEventListener('click', ev => {
        const btn = (ev.target as HTMLElement).closest('[data-view-id]')
        if (btn) {
          dispatch({ type: 'select', id: btn.getAttribute('data-view-id') })
          popupRef.current?.remove()
        }
      })
      popupRef.current = new maplibregl.Popup({ offset: 10, maxWidth: '300px' })
        .setLngLat(coords)
        .setDOMContent(node)
        .addTo(map)
    }

    return () => { popupRef.current?.remove(); map.remove(); mapRef.current = null }
  }, [ds, dispatch])

  // Push filtered data into the source
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const update = () => (map.getSource('alumni') as maplibregl.GeoJSONSource | undefined)?.setData(toGeoJSON(ds, filtered))
    if (loadedRef.current) update()
    else map.once('load', update)
  }, [ds, filtered])

  // Hover highlight from the list + fly to selection
  const prevHover = useRef<number | null>(null)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    if (prevHover.current != null) map.setFeatureState({ source: 'alumni', id: prevHover.current }, { hi: false })
    if (hoveredIndex != null) map.setFeatureState({ source: 'alumni', id: hoveredIndex }, { hi: true })
    prevHover.current = hoveredIndex
  }, [hoveredIndex])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedId) return
    const p = ds.byId.get(selectedId)
    if (p?.g && map.getZoom() < 8) map.easeTo({ center: p.g, zoom: 8, duration: 600 })
  }, [ds, selectedId])

  // When a cohort lens switches on, show the whole circle at once
  const cohortKey = filters.cohort ? `${filters.cohort.mode}:${filters.cohort.id}` : null
  useEffect(() => {
    if (!cohortKey) return
    const t = setTimeout(fitToResults, 150) // after the source data updates
    return () => clearTimeout(t)
  }, [cohortKey])

  return (
    <div className="map-wrap">
      <div ref={containerRef} className="map-container" aria-label="Alumni map" />
      <button className="map-fit-btn" onClick={fitToResults} title="Zoom to fit all results">
        ⤢ Fit results
      </button>
    </div>
  )
}
