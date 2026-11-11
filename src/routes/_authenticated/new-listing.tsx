import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ImagePlus, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { listingSchema, categories, cities, cityCoords, pageHead, UZBEKISTAN_CENTER } from '@/lib/marketplace';
import { useI18n, type TKey } from '@/lib/i18n';
import { LocationPicker, type LatLng } from '@/components/location-map';
import { saveListing } from '@/lib/listings.functions';
export const Route=createFileRoute('/_authenticated/new-listing')({validateSearch:(s:Record<string,unknown>):{edit?:string|undefined}=>({edit:typeof s['edit']==='string'?s['edit']:undefined}),head:()=>pageHead('Bepul e’lon berish','QULAYJOY’da turar joy e’loningizni bepul joylashtiring.'),loaderDeps:({search})=>({edit:search.edit}),loader:async({deps})=>{if(!deps['edit'])return null;const r=await supabase.from('listings').select('*').eq('id',deps['edit']).single();if(r.error)throw r.error;return r.data;},component:NewListing});
const AMENITIES = ['Wi-Fi', 'Konditsioner', 'Oshxona', 'Kir yuvish mashinasi', 'Avtoturargoh', 'Mebel', 'Lift', 'Isitish'];

function NewListing() {
  const { t, td } = useI18n();
  const existing = Route.useLoaderData();
  const [category, setCategory] = useState(existing?.category ?? 'hotel');
  const [city, setCity] = useState(existing?.city ?? 'Toshkent');
  const [point, setPoint] = useState<LatLng | null>(
    existing?.latitude != null && existing?.longitude != null ? { lat: Number(existing.latitude), lng: Number(existing.longitude) } : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const save = useServerFn(saveListing);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const center = cityCoords[city] ?? UZBEKISTAN_CENTER;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) ?? '');
    try {
      const parsed = listingSchema.safeParse({
        title: str('title'),
        description: str('description'),
        category,
        city,
        district: str('district'),
        address: str('address'),
        latitude: point ? point.lat : null,
        longitude: point ? point.lng : null,
        price: str('price'),
        payment_period: str('payment_period'),
        available_places: str('available_places'),
        total_places: str('total_places'),
        rooms: str('rooms'),
        floor: str('floor') ? Number(str('floor')) : null,
        room_number: str('room_number'),
        available_from: str('available_from') || null,
        available_to: str('available_to') || null,
        amenities: f.getAll('amenities').map(String),
        house_rules: str('house_rules'),
        status: str('status'),
      });
      if (!parsed.success) {
        // Schema messages for cross-field rules are i18n keys; everything else gets the generic hint.
        const custom = parsed.error.issues.find(i => i.message.startsWith('err.'));
        throw new Error(custom ? t(custom.message as TKey) : t('new.errIncomplete'));
      }
      const u = await supabase.auth.getUser();
      if (!u.data.user) throw new Error(t('new.errLogin'));
      const uploads: string[] = [];
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024 || !/^(image|video)\//.test(file.type)) throw new Error(t('new.errFile'));
        const path = `${u.data.user.id}/${crypto.randomUUID()}`;
        const up = await supabase.storage.from('listing-media').upload(path, file);
        if (up.error) throw up.error;
        uploads.push(path);
      }
      const saved = await save({ data: { id: existing?.id, listing: parsed.data } });
      if (uploads.length) {
        const media = await supabase.from('listing_images').insert(
          uploads.map((path, index) => ({
            listing_id: saved.id,
            storage_path: path,
            position: index,
            media_type: files[index]?.type.startsWith('video/') ? 'video' : 'image',
          })),
        );
        if (media.error) throw new Error(t('new.errMedia'));
      }
      await qc.invalidateQueries();
      await navigate({ to: '/profile' });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('new.errSave'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-width">
      <div className="form-layout">
        <span className="text-primary text-xs font-bold">{t('new.kicker')}</span>
        <h1 className="section-heading mt-3">{existing ? t('new.titleEdit') : t('new.titleNew')}</h1>
        <div className="notice mt-5 flex items-center gap-2">
          <CheckCircle2 size={18} />
          {t('new.freeNotice')}
        </div>
        <form onSubmit={submit}>
          <section className="form-section">
            <h2>{t('new.main')}</h2>
            <div className="form-grid">
              <label className="field">
                {t('new.name')}
                <input name="title" minLength={5} maxLength={160} required defaultValue={existing?.title} placeholder={t('new.namePh')} />
              </label>
              <label className="field">
                {t('new.category')}
                <select value={category} onChange={e => setCategory(e.target.value)}>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {td('cat', c.id)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                {t('new.city')}
                <select value={city} onChange={e => setCity(e.target.value)}>
                  {cities.map(c => (
                    <option key={c} value={c}>
                      {td('city', c)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                {t('new.district')}
                <input name="district" maxLength={100} defaultValue={existing?.district} placeholder={t('new.districtPh')} />
              </label>
            </div>
            <label className="field mt-5">
              {t('new.description')}
              <textarea name="description" minLength={20} maxLength={5000} required defaultValue={existing?.description} placeholder={t('new.descriptionPh')} />
            </label>
            <label className="field mt-5">
              {t('new.address')}
              <input name="address" maxLength={250} defaultValue={existing?.address} />
            </label>
            <LocationPicker value={point} onChange={setPoint} fallbackCenter={center} />
          </section>

          <section className="form-section">
            <h2>{t('new.priceSection')}</h2>
            <div className="form-grid">
              <label className="field">
                {t('new.price')}
                <input name="price" type="number" min={0} max={100000000000} required defaultValue={existing?.price} />
              </label>
              <label className="field">
                {t('new.period')}
                <select key={category} name="payment_period" defaultValue={existing?.payment_period ?? categories.find(c => c.id === category)?.period}>
                  <option value="daily">{t('periodName.daily')}</option>
                  <option value="weekly">{t('periodName.weekly')}</option>
                  <option value="monthly">{t('periodName.monthly')}</option>
                </select>
              </label>
              <label className="field">
                {t('new.available')}
                <input name="available_places" type="number" min={1} max={1000} required defaultValue={existing?.available_places ?? 1} />
              </label>
              <label className="field">
                {t('new.total')}
                <input name="total_places" type="number" min={1} max={1000} required defaultValue={existing?.total_places ?? 1} />
              </label>
              <label className="field">
                {t('new.rooms')}
                <input name="rooms" type="number" min={1} max={100} required defaultValue={existing?.rooms ?? 1} />
              </label>
              <label className="field">
                {t('new.floor')}
                <input name="floor" type="number" min={-5} max={100} defaultValue={existing?.floor ?? ''} />
              </label>
              {category === 'hotel' && (
                <label className="field">
                  {t('new.roomNumber')}
                  <input name="room_number" maxLength={30} defaultValue={existing?.room_number ?? ''} />
                </label>
              )}
              <label className="field">
                {t('new.from')}
                <input type="date" name="available_from" defaultValue={existing?.available_from ?? ''} />
              </label>
              <label className="field">
                {t('new.to')}
                <input type="date" name="available_to" defaultValue={existing?.available_to ?? ''} />
              </label>
            </div>
          </section>

          <section className="form-section">
            <h2>{t('new.mediaSection')}</h2>
            <label className="field">
              <span className="flex items-center gap-2">
                <ImagePlus size={18} />
                {t('new.media')}
              </span>
              <input type="file" multiple accept="image/*,video/*" onChange={e => setFiles(Array.from(e.target.files ?? []))} />
            </label>
            {files.length > 0 && <p className="text-sm text-primary mt-3">{t('new.filesChosen', { n: files.length })}</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6">
              {AMENITIES.map(a => (
                <label key={a} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="amenities" value={a} defaultChecked={existing?.amenities.includes(a)} />
                  {td('amenity', a)}
                </label>
              ))}
            </div>
            <label className="field mt-5">
              {t('new.rules')}
              <textarea name="house_rules" maxLength={1500} defaultValue={existing?.house_rules} />
            </label>
          </section>

          <div className="flex items-end gap-4 mt-6">
            <label className="field flex-1">
              {t('new.status')}
              <select name="status" defaultValue={existing?.status ?? 'active'}>
                <option value="active">{t('new.statusActive')}</option>
                <option value="draft">{t('new.statusDraft')}</option>
                <option value="paused">{t('new.statusPaused')}</option>
              </select>
            </label>
            <Button disabled={busy} className="h-12">
              {busy ? t('new.saving') : existing ? t('new.save') : t('new.publish')}
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-destructive mt-4 text-sm">
              {error}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
