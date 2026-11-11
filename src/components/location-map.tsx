import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker, LayerGroup } from 'leaflet';
import { LocateFixed, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { UZBEKISTAN_CENTER } from '@/lib/marketplace';

type Leaflet = typeof import('leaflet');

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Leaflet touches `window`, so it is only imported in the browser, after mount. */
function useLeafletMap(containerRef: React.RefObject<HTMLDivElement | null>, center: [number, number], zoom: number) {
  const [state, setState] = useState<{ L: Leaflet; map: LeafletMap } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;
    (async () => {
      try {
        const [L] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]);
        const lib = ((L as unknown as { default?: Leaflet }).default ?? L) as Leaflet;
        if (cancelled || !containerRef.current) return;
        map = lib.map(containerRef.current, { scrollWheelZoom: false }).setView(center, zoom);
        lib.tileLayer(TILE_URL, { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
        // Ctrl/⌘ + wheel zooms, so the page can still scroll normally past the map.
        map.getContainer().addEventListener('wheel', e => {
          if (e.ctrlKey || e.metaKey) map?.scrollWheelZoom.enable();
          else map?.scrollWheelZoom.disable();
        });
        setState({ L: lib, map });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      map?.remove();
      setState(null);
    };
    // The map is created once; center/zoom are only initial values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ...(state ?? { L: null, map: null }), failed };
}

function pinIcon(L: Leaflet, approx: boolean) {
  return L.divIcon({
    className: 'map-pin-wrap',
    html: `<span class="map-pin${approx ? ' map-pin-approx' : ''}"></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -24],
  });
}

export type MapListing = {
  id: string;
  lat: number;
  lng: number;
  approx: boolean;
  title: string;
  subtitle: string;
  price: string;
  category?: string;
  description?: string;
  image?: string | null;
  rooms?: number;
  places?: number;
};

function distanceKm(a: [number, number], b: [number, number]) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
const fmtKm = (km: number) => (km < 10 ? km.toFixed(1) : String(Math.round(km)));

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Read-only map: tap a pin to see a small card with photo, price and a short description. */
export function ListingsMap({
  items,
  onOpen,
  height = 520,
  maxZoom = 15,
  showLocate = false,
}: {
  items: MapListing[];
  onOpen?: (id: string) => void;
  height?: number;
  maxZoom?: number;
  showLocate?: boolean;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const layer = useRef<LayerGroup | null>(null);
  const userLayer = useRef<LayerGroup | null>(null);
  const [user, setUser] = useState<[number, number] | null>(null);
  const [geoError, setGeoError] = useState(false);
  const [nearest, setNearest] = useState<number | null>(null);
  const { L, map, failed } = useLeafletMap(ref, UZBEKISTAN_CENTER, 6);

  // Pins + popup cards. Built with DOM nodes/textContent: listing text is user input and must never be parsed as HTML.
  useEffect(() => {
    if (!L || !map) return;
    layer.current?.remove();
    const group = L.layerGroup().addTo(map);
    layer.current = group;
    for (const item of items) {
      const card = el('div', 'map-card');
      if (item.image) {
        const img = el('img', 'map-card-photo');
        img.src = item.image;
        img.alt = item.title;
        img.loading = 'lazy';
        card.append(img);
      }
      const body = el('div', 'map-card-body');
      if (item.category) body.append(el('span', 'map-card-cat', item.category));
      body.append(el('strong', 'map-card-title', item.title));
      body.append(el('div', 'map-card-sub', item.subtitle));
      body.append(el('div', 'map-card-price', item.price));
      const facts = [item.rooms ? t('map.rooms', { n: item.rooms }) : '', item.places ? t('map.places', { n: item.places }) : ''].filter(Boolean);
      if (facts.length) body.append(el('div', 'map-card-facts', facts.join(' · ')));
      if (item.description) {
        const d = item.description.replace(/\s+/g, ' ').trim();
        body.append(el('p', 'map-card-desc', d.length > 110 ? `${d.slice(0, 110)}…` : d));
      }
      if (user) body.append(el('div', 'map-card-dist', t('map.distance', { km: fmtKm(distanceKm(user, [item.lat, item.lng])) })));
      if (item.approx) body.append(el('div', 'map-card-note', t('map.approx')));
      const link = el('a', 'map-card-link', `${t('map.open')} →`);
      link.href = `/listing/${item.id}`;
      link.addEventListener('click', e => {
        if (onOpen) {
          e.preventDefault();
          onOpen(item.id);
        }
      });
      body.append(link);
      card.append(body);
      L.marker([item.lat, item.lng], { icon: pinIcon(L, item.approx), title: item.title, keyboard: true })
        .bindPopup(card, { maxWidth: 300, minWidth: 220, autoPanPaddingTopLeft: [16, 16], autoPanPaddingBottomRight: [16, 16], className: 'map-card-popup' })
        .addTo(group);
    }
  }, [L, map, items, onOpen, t, user]);

  // Fit the view to the listings only when the listings change (not when the user location arrives).
  useEffect(() => {
    if (!L || !map) return;
    if (items.length) map.fitBounds(L.latLngBounds(items.map(i => [i.lat, i.lng] as [number, number])), { padding: [40, 40], maxZoom });
    else map.setView(UZBEKISTAN_CENTER, 6);
  }, [L, map, items, maxZoom]);

  // "You are here" marker.
  useEffect(() => {
    if (!L || !map) return;
    userLayer.current?.remove();
    if (!user) return;
    const g = L.layerGroup().addTo(map);
    L.circleMarker(user, { radius: 9, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).bindTooltip(t('map.youAreHere')).addTo(g);
    userLayer.current = g;
  }, [L, map, user, t]);

  useEffect(() => {
    if (map) setTimeout(() => map.invalidateSize(), 0);
  }, [map]);

  function locate() {
    setGeoError(false);
    if (!navigator.geolocation) return setGeoError(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const me: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUser(me);
        if (!L || !map) return;
        if (items.length) {
          const closest = items.reduce((best, i) => (distanceKm(me, [i.lat, i.lng]) < distanceKm(me, [best.lat, best.lng]) ? i : best));
          setNearest(distanceKm(me, [closest.lat, closest.lng]));
          map.fitBounds(L.latLngBounds([me, [closest.lat, closest.lng]]), { padding: [60, 60], maxZoom: 15 });
        } else {
          map.setView(me, 14);
        }
      },
      () => setGeoError(true),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div>
      <div className="map-shell" style={{ ['--map-h' as string]: `${height}px` }}>
        <div ref={ref} className="map-canvas" role="region" aria-label={t('view.map')} />
        {showLocate && L && (
          <Button type="button" size="sm" className="map-locate" onClick={locate}>
            <LocateFixed />
            {t('map.nearMe')}
          </Button>
        )}
        {!L && !failed && <div className="map-overlay">{t('map.loading')}</div>}
        {failed && <div className="map-overlay">{t('map.loadError')}</div>}
        {L && !items.length && <div className="map-overlay map-overlay-soft">{t('map.empty')}</div>}
      </div>
      {(geoError || nearest !== null) && (
        <p className="text-xs text-muted-foreground mt-2" role="status">
          {geoError ? t('map.geoFail') : t('map.nearestFound', { km: fmtKm(nearest ?? 0) })}
        </p>
      )}
    </div>
  );
}

export type LatLng = { lat: number; lng: number };

/** Click-to-place / draggable pin used when posting or editing a listing. */
export function LocationPicker({
  value,
  onChange,
  fallbackCenter,
}: {
  value: LatLng | null;
  onChange: (value: LatLng | null) => void;
  fallbackCenter: [number, number];
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const marker = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [geoError, setGeoError] = useState(false);
  const initial: [number, number] = value ? [value.lat, value.lng] : fallbackCenter;
  const { L, map, failed } = useLeafletMap(ref, initial, value ? 15 : 11);

  // Register the click handler once the map exists.
  useEffect(() => {
    if (!map) return;
    const handler = (e: { latlng: { lat: number; lng: number } }) => onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
    map.on('click', handler);
    return () => {
      map.off('click', handler);
    };
  }, [map]);

  // Keep the marker in sync with `value`.
  useEffect(() => {
    if (!L || !map) return;
    if (!value) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      const m = L.marker([value.lat, value.lng], { icon: pinIcon(L, false), draggable: true }).addTo(map);
      m.on('dragend', () => {
        const p = m.getLatLng();
        onChangeRef.current({ lat: p.lat, lng: p.lng });
      });
      marker.current = m;
    } else {
      marker.current.setLatLng([value.lat, value.lng]);
    }
  }, [L, map, value]);

  // Recentre when the city changes and no pin has been placed yet.
  useEffect(() => {
    if (map && !value) map.setView(fallbackCenter, 11);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fallbackCenter[0], fallbackCenter[1]]);

  useEffect(() => {
    if (map) setTimeout(() => map.invalidateSize(), 0);
  }, [map]);

  function locate() {
    setGeoError(false);
    if (!navigator.geolocation) {
      setGeoError(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onChange(next);
        map?.setView([next.lat, next.lng], 16);
      },
      () => setGeoError(true),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div>
          <h3 className="text-sm font-bold">{t('map.pickTitle')}</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">{t('map.pickHint')}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={locate}>
            <LocateFixed />
            {t('map.myLocation')}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              <Trash2 />
              {t('map.clear')}
            </Button>
          )}
        </div>
      </div>
      <div className="map-shell" style={{ ['--map-h' as string]: '320px' }}>
        <div ref={ref} className="map-canvas" />
        {!L && !failed && <div className="map-overlay">{t('map.loading')}</div>}
        {failed && <div className="map-overlay">{t('map.loadError')}</div>}
      </div>
      <p className="text-xs text-muted-foreground mt-2" role="status">
        {geoError ? t('map.geoFail') : value ? `${t('map.selected')}: ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : t('map.none')}
      </p>
    </div>
  );
}
