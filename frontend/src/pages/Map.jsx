import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { BUILDINGS, BUILDING_CATEGORIES, CAMPUS_CENTER, CAMPUS_ZOOM } from '../data/buildings'

const MORGAN_OFFICIAL_MAP = 'https://www.morgan.edu/campus-map'

function makePinIcon(color) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 44" width="32" height="44">
      <path d="M16 0C7.16 0 0 7.16 0 16c0 11 16 28 16 28s16-17 16-28C32 7.16 24.84 0 16 0z" fill="${color}" stroke="#fff" stroke-width="2"/>
      <circle cx="16" cy="16" r="6" fill="#fff"/>
    </svg>`
  return L.divIcon({
    html: svg,
    className: 'bearboard-pin',
    iconSize: [32, 44],
    iconAnchor: [16, 44],
    popupAnchor: [0, -40],
  })
}

function CategoryChip({ cat, active, onClick, count }) {
  const meta = BUILDING_CATEGORIES[cat]
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 text-[0.7rem] font-semibold py-[5px] px-3 border rounded-full cursor-pointer uppercase tracking-wide transition-all ${
        active
          ? 'bg-navy border-navy text-white shadow-[0_1px_3px_rgba(11,29,52,0.2)]'
          : 'bg-card border-lightgray text-gray hover:border-navy hover:text-navy hover:bg-offwhite'
      }`}
    >
      <span
        className="w-2 h-2 rounded-full"
        style={{ background: active ? '#fff' : meta.color }}
        aria-hidden="true"
      />
      {meta.label}
      <span className={`text-[0.6rem] font-archivo font-extrabold ${active ? 'text-white/70' : 'text-gray/70'}`}>
        {count}
      </span>
    </button>
  )
}

function CampusMap() {
  const mapEl = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef(new Map())
  const [query, setQuery] = useState('')
  const [activeCats, setActiveCats] = useState(() => new Set(Object.keys(BUILDING_CATEGORIES)))
  const [selectedId, setSelectedId] = useState(null)

  const filteredBuildings = useMemo(() => {
    const q = query.trim().toLowerCase()
    return BUILDINGS.filter((b) => {
      if (!activeCats.has(b.category)) return false
      if (!q) return true
      const hay = [b.name, b.description, ...(b.aliases || [])].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [query, activeCats])

  const counts = useMemo(() => {
    const out = {}
    for (const key of Object.keys(BUILDING_CATEGORIES)) out[key] = 0
    for (const b of BUILDINGS) out[b.category] = (out[b.category] || 0) + 1
    return out
  }, [])

  // One-time map init
  useEffect(() => {
    if (mapRef.current || !mapEl.current) return
    const map = L.map(mapEl.current, {
      center: [CAMPUS_CENTER.lat, CAMPUS_CENTER.lng],
      zoom: CAMPUS_ZOOM,
      zoomControl: true,
      scrollWheelZoom: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)
    mapRef.current = map
    // Force a resize tick so tiles render correctly inside the flex layout
    setTimeout(() => map.invalidateSize(), 50)
    return () => {
      map.remove()
      mapRef.current = null
      markersRef.current.clear()
    }
  }, [])

  // Sync markers to filtered set
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const keep = new Set(filteredBuildings.map((b) => b.id))

    // Remove markers no longer in the filtered set
    for (const [id, marker] of markersRef.current.entries()) {
      if (!keep.has(id)) {
        marker.remove()
        markersRef.current.delete(id)
      }
    }
    // Add missing
    for (const b of filteredBuildings) {
      if (markersRef.current.has(b.id)) continue
      const color = BUILDING_CATEGORIES[b.category]?.color || '#0B1D34'
      const marker = L.marker([b.lat, b.lng], { icon: makePinIcon(color) })
      const popup = `
        <div style="font-family:Archivo,sans-serif;min-width:200px;">
          <div style="font-weight:900;font-size:0.95rem;color:#0B1D34;line-height:1.2;margin-bottom:4px;">
            ${b.name}
          </div>
          <div style="font-size:0.75rem;color:#6b7280;margin-bottom:8px;line-height:1.35;">
            ${b.description || ''}
          </div>
          <a href="${MORGAN_OFFICIAL_MAP}" target="_blank" rel="noreferrer"
            style="display:inline-block;font-size:0.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#0B1D34;background:#EDCB67;padding:5px 10px;border-radius:999px;text-decoration:none;">
            Open in Morgan Campus Map &rarr;
          </a>
        </div>`
      marker.bindPopup(popup)
      marker.on('click', () => setSelectedId(b.id))
      marker.addTo(map)
      markersRef.current.set(b.id, marker)
    }
  }, [filteredBuildings])

  const focusBuilding = (b) => {
    const map = mapRef.current
    if (!map) return
    map.flyTo([b.lat, b.lng], 18, { duration: 0.6 })
    const marker = markersRef.current.get(b.id)
    if (marker) marker.openPopup()
    setSelectedId(b.id)
  }

  const toggleCategory = (cat) => {
    setActiveCats((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-navy px-6 pt-10 pb-9">
        <div className="max-w-[1080px] mx-auto flex justify-between items-end gap-10 flex-col md:flex-row md:items-end">
          <div className="max-w-[560px]">
            <h1 className="font-archivo font-black text-[1.85rem] sm:text-[2.4rem] text-white leading-[1.05] tracking-tight uppercase">
              Find a spot <span className="text-gold block">on campus</span>
            </h1>
            <p className="text-white/50 text-[0.92rem] mt-3 leading-relaxed max-w-[420px]">
              Search Morgan State buildings, filter by category, and drop into the right part of campus.
            </p>
          </div>
          <div className="flex gap-8">
            <HeaderNum value={BUILDINGS.length} label="Buildings" />
            <HeaderNum value={Object.keys(BUILDING_CATEGORIES).length} label="Categories" />
          </div>
        </div>
      </div>
      <hr className="h-[3px] bg-gold border-none m-0" />

      <div className="max-w-[1080px] mx-auto px-6 py-7 grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6">
        {/* Sidebar: search + list */}
        <aside className="order-2 md:order-1">
          <div className="mb-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search buildings..."
              className="w-full bg-card border border-lightgray text-ink font-franklin text-[0.85rem] py-2.5 px-3.5 rounded outline-none focus:border-navy transition-colors placeholder:text-gray"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 mb-4">
            {Object.keys(BUILDING_CATEGORIES).map((cat) => (
              <CategoryChip
                key={cat}
                cat={cat}
                active={activeCats.has(cat)}
                onClick={() => toggleCategory(cat)}
                count={counts[cat] || 0}
              />
            ))}
          </div>

          <div className="border border-lightgray bg-card overflow-hidden">
            <div className="font-archivo font-extrabold text-[0.7rem] uppercase tracking-widest px-4 py-3 bg-navy text-gold">
              {filteredBuildings.length} {filteredBuildings.length === 1 ? 'building' : 'buildings'}
            </div>
            {filteredBuildings.length === 0 ? (
              <div className="px-4 py-6 text-[0.82rem] text-gray text-center">
                No buildings match.
                <br />
                Try a different search or category.
              </div>
            ) : (
              <div className="max-h-[460px] overflow-y-auto">
                {filteredBuildings.map((b) => {
                  const meta = BUILDING_CATEGORIES[b.category]
                  const isSelected = selectedId === b.id
                  return (
                    <button
                      key={b.id}
                      onClick={() => focusBuilding(b)}
                      className={`w-full text-left flex gap-3 items-start px-4 py-3 border-b border-[#EAE7E0] last:border-b-0 transition-colors cursor-pointer ${
                        isSelected ? 'bg-gold-pale' : 'bg-transparent hover:bg-offwhite'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                        style={{ background: meta.color }}
                        aria-hidden="true"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[0.82rem] font-semibold leading-tight text-ink">{b.name}</div>
                        <div className="text-[0.68rem] text-gray uppercase tracking-wide font-archivo font-bold mt-0.5">
                          {meta.label}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Map */}
        <div className="order-1 md:order-2">
          <div
            ref={mapEl}
            // Viewport-relative on mobile so the map fits above the
            // BottomNav (56px) without forcing the user to scroll past
            // hidden Leaflet pan controls. Fixed height returns at md+
            // where the BottomNav doesn't dominate the viewport.
            className="w-full h-[60vh] min-h-[360px] md:h-[620px] border border-lightgray bg-offwhite"
            aria-label="Morgan State campus map"
          />
          <div className="mt-2 text-[0.68rem] text-gray font-archivo">
            Pin locations are approximate.{' '}
            <a href={MORGAN_OFFICIAL_MAP} target="_blank" rel="noreferrer" className="text-navy underline">
              Open the official Morgan State campus map
            </a>{' '}
            for the authoritative view.
          </div>
        </div>
      </div>
    </div>
  )
}

function HeaderNum({ value, label }) {
  return (
    <div className="text-right">
      <div className="font-archivo font-black text-[2rem] text-gold leading-none tracking-tight">{value}</div>
      <div className="text-white/35 text-[0.68rem] uppercase tracking-widest font-semibold mt-1">{label}</div>
    </div>
  )
}

export default CampusMap
