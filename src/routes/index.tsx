import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { Hotel, BedDouble, Building2, CalendarDays, Home, UsersRound, DoorOpen, MapPin, Search, ArrowRight, SlidersHorizontal, ShieldCheck, BadgeCheck, ImageOff, Plus, X, List, Map as MapIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { categories, cities, pageHead, listingPoint } from '@/lib/marketplace';
import { useI18n } from '@/lib/i18n';
import { ListingsMap } from '@/components/location-map';
import { publicListingsOptions } from '@/lib/listings.functions';
import tashkent from '@/assets/tashkent-city.jpg';
import samarkand from '@/assets/samarkand.jpg';
import bukhara from '@/assets/bukhara.jpg';
import khiva from '@/assets/khiva.jpg';
type SearchState={category?:string|undefined;city?:string|undefined;district?:string|undefined;date?:string|undefined;end?:string|undefined;guests?:number|undefined;rooms?:number|undefined;min?:number|undefined;max?:number|undefined;sort?:string|undefined};
export const Route=createFileRoute('/')({
 validateSearch:(s:Record<string,unknown>):SearchState=>({category:typeof s['category']==='string'?s['category']:undefined,city:typeof s['city']==='string'?s['city']:undefined,district:typeof s['district']==='string'?s['district']:undefined,date:typeof s['date']==='string'?s['date']:undefined,end:typeof s['end']==='string'?s['end']:undefined,guests:Number(s['guests'])||undefined,rooms:Number(s['rooms'])||undefined,min:Number(s['min'])||undefined,max:Number(s['max'])||undefined,sort:typeof s['sort']==='string'?s['sort']:undefined}),
 head:()=>pageHead('O‘zingizga mos joyni oson toping!','O‘zbekiston bo‘ylab mehmonxona, hostel, kvartira va birga yashash uchun joylarni QULAYJOY’da toping.'),
 loader:({context})=>context.queryClient.ensureQueryData(publicListingsOptions),component:Index,
});
function Index() {
  const { t, td, price } = useI18n();
  const { data: listings } = useSuspenseQuery(publicListingsOptions);
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [filters, setFilters] = useState(false);
  const [category, setCategory] = useState(search.category ?? '');
  const [view, setView] = useState<'list' | 'map'>('list');
  const icons = [Hotel, BedDouble, Building2, CalendarDays, Building2, Home, UsersRound, DoorOpen, BedDouble, Home];
  const longStay = ['roommate', 'room', 'long_term', 'apartment_monthly', 'house'].includes(category);

  let results = listings.filter(
    l =>
      (!search.category || l.category === search.category) &&
      (!search.city || l.city === search.city) &&
      (!search.district || l.district.toLocaleLowerCase().includes(search.district.toLocaleLowerCase())) &&
      (!search.guests || l.available_places >= search.guests) &&
      (!search.rooms || l.rooms >= search.rooms) &&
      (!search.min || l.price >= search.min) &&
      (!search.max || l.price <= search.max) &&
      (!search.date || !l.available_from || l.available_from <= search.date) &&
      (!search.end || !l.available_to || l.available_to >= search.end),
  );
  if (search.sort === 'price') results = [...results].sort((a, b) => a.price - b.price);

  const mapItems = useMemo(
    () =>
      results.flatMap(l => {
        const point = listingPoint(l);
        if (!point) return [];
        return [
          {
            ...point,
            title: l.title,
            category: td('cat', l.category),
            description: l.description,
            image: l.media.find(m => m.media_type === 'image')?.url ?? null,
            rooms: l.rooms,
            places: l.available_places,
            subtitle: `${td('city', l.city)}${l.district ? `, ${l.district}` : ''}`,
            price: `${price(l.price)} ${t('currency')} / ${td('period', l.payment_period)}`,
          },
        ];
      }),
    // `results` is derived from listings + search, so those are the real dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listings, search.category, search.city, search.district, search.guests, search.rooms, search.min, search.max, search.date, search.end, search.sort, t, td, price],
  );
  const hasApprox = mapItems.some(i => i.approx);
  const openListing = useCallback((id: string) => void navigate({ to: '/listing/$id', params: { id } }), [navigate]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    navigate({
      to: '/',
      search: {
        ...search,
        category: category || undefined,
        city: String(f.get('city') ?? '') || undefined,
        date: String(f.get('date') ?? '') || undefined,
        end: String(f.get('end') ?? '') || undefined,
        guests: Number(f.get('guests')) || undefined,
        rooms: Number(f.get('rooms')) || undefined,
      },
    }).then(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  const trust = [
    { icon: ShieldCheck, title: t('trust.privacy.title'), text: t('trust.privacy.text') },
    { icon: BadgeCheck, title: t('trust.free.title'), text: t('trust.free.text') },
    { icon: UsersRound, title: t('trust.account.title'), text: t('trust.account.text') },
  ];
  const cityTiles = [
    { city: 'Toshkent', image: tashkent },
    { city: 'Samarqand', image: samarkand },
    { city: 'Buxoro', image: bukhara },
    { city: 'Xiva', image: khiva },
  ];

  return (
    <main className="page-width pt-6">
      <section className="home-cover">
        <img src={tashkent} width={1920} height={1024} alt={t('hero.alt')} fetchPriority="high" />
        <div className="cover-content">
          <span className="cover-label">
            <MapPin size={15} />
            {t('hero.label')}
          </span>
          <h1>
            QULAYJOY<span className="text-highlight">.</span>
          </h1>
          <h2 className="text-2xl sm:text-3xl font-semibold mt-3 max-w-lg">{t('tagline')}</h2>
          <p className="mt-4 text-sm max-w-md">{t('hero.sub')}</p>
        </div>
      </section>

      <form className="search-panel" onSubmit={submit}>
        <div className="flex gap-5 mb-5 text-sm font-semibold">
          <span className="text-primary flex items-center gap-2">
            <Search size={17} />
            {t('search.title')}
          </span>
          <span className="text-muted-foreground text-xs self-center hidden sm:block">{t('search.tagline')}</span>
        </div>
        <div className="search-fields">
          <label className="field">
            <span className="flex items-center gap-2">
              <MapPin size={14} />
              {t('search.where')}
            </span>
            <select name="city" defaultValue={search.city ?? ''}>
              <option value="">{t('search.allCities')}</option>
              {cities.map(c => (
                <option key={c} value={c}>
                  {td('city', c)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="flex items-center gap-2">
              <CalendarDays size={14} />
              {longStay ? t('search.from') : t('search.arrive')}
            </span>
            <input name="date" type="date" defaultValue={search.date} />
          </label>
          {!longStay ? (
            <label className="field">
              <span className="flex items-center gap-2">
                <CalendarDays size={14} />
                {t('search.depart')}
              </span>
              <input name="end" type="date" defaultValue={search.end} />
            </label>
          ) : (
            <label className="field">
              {t('search.rooms')}
              <input name="rooms" type="number" min={1} max={100} placeholder={t('search.any')} defaultValue={search.rooms} />
            </label>
          )}
          <label className="field">
            <span className="flex items-center gap-2">
              <UsersRound size={14} />
              {longStay ? t('search.people') : t('search.guests')}
            </span>
            <input name="guests" type="number" min={1} max={1000} placeholder={t('search.onePerson')} defaultValue={search.guests} />
          </label>
          <Button className="h-[46px] px-7">
            <Search />
            {t('search.btn')}
          </Button>
        </div>
      </form>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="section-heading">{t('cats.heading')}</h2>
          <Button
            variant="link"
            onClick={() => {
              setCategory('');
              navigate({ to: '/', search: { ...search, category: undefined } });
            }}
            className="text-xs"
          >
            {t('cats.all')}
            <ArrowRight />
          </Button>
        </div>
        <div className="category-row mt-5">
          {categories.map((c, i) => {
            const Icon = icons[i] ?? Home;
            return (
              <Button
                variant="ghost"
                key={c.id}
                className="category-tab"
                data-active={category === c.id}
                onClick={() => {
                  setCategory(c.id);
                  navigate({ to: '/', search: { ...search, category: c.id } });
                }}
              >
                <Icon />
                {td('cat', c.id)}
              </Button>
            );
          })}
        </div>
      </section>

      <section id="results" className="mt-9 scroll-mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="section-heading">{search.city ? t('results.inCity', { city: td('city', search.city) }) : t('results.default')}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t('results.count', { n: results.length })} {search.category ? `· ${td('cat', search.category)}` : `· ${t('results.new')}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="view-toggle" role="group" aria-label={`${t('view.list')} / ${t('view.map')}`}>
              <button type="button" data-active={view === 'list'} onClick={() => setView('list')}>
                <List size={16} />
                {t('view.list')}
              </button>
              <button type="button" data-active={view === 'map'} onClick={() => setView('map')}>
                <MapIcon size={16} />
                {t('view.map')}
              </button>
            </div>
            <select
              aria-label={t('sort.label')}
              value={search.sort ?? 'newest'}
              className="text-xs bg-background border border-input rounded-md px-3"
              onChange={e => navigate({ to: '/', search: { ...search, sort: e.target.value } })}
            >
              <option value="newest">{t('sort.newest')}</option>
              <option value="price">{t('sort.price')}</option>
            </select>
            <Button variant="outline" onClick={() => setFilters(!filters)}>
              <SlidersHorizontal />
              {t('filters.btn')}
            </Button>
          </div>
        </div>

        {filters && (
          <form
            className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5 bg-muted p-5"
            onSubmit={e => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              navigate({
                to: '/',
                search: {
                  ...search,
                  min: Number(f.get('min')) || undefined,
                  max: Number(f.get('max')) || undefined,
                  district: String(f.get('district')) || undefined,
                },
              });
            }}
          >
            <label className="field">
              {t('filters.from')}
              <input name="min" type="number" min={0} defaultValue={search.min} />
            </label>
            <label className="field">
              {t('filters.to')}
              <input name="max" type="number" min={0} defaultValue={search.max} />
            </label>
            <label className="field">
              {t('filters.district')}
              <input name="district" defaultValue={search.district} />
            </label>
            <Button className="self-end h-[46px]">{t('filters.apply')}</Button>
          </form>
        )}

        {Object.values(search).some(Boolean) && (
          <Button
            variant="link"
            className="mb-4"
            onClick={() => {
              setCategory('');
              navigate({ to: '/', search: {} });
            }}
          >
            <X />
            {t('filters.clear')}
          </Button>
        )}

        {view === 'map' ? (
          <>
            <ListingsMap items={mapItems} onOpen={openListing} height={560} showLocate />
            {hasApprox && <p className="text-xs text-muted-foreground mt-3">{t('map.approxNote')}</p>}
          </>
        ) : !results.length ? (
          <div className="empty-results">
            <Search className="empty-icon" />
            <h3 className="text-lg font-bold">{listings.length ? t('empty.none') : t('empty.first')}</h3>
            <p className="text-sm text-muted-foreground mt-2">{listings.length ? t('empty.noneHint') : t('empty.firstHint')}</p>
            <Button variant="outline" asChild className="mt-5">
              <Link to="/new-listing">
                <Plus />
                {t('empty.post')}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {results.map(l => {
              const photo = l.media.find(m => m.media_type === 'image')?.url;
              return (
                <Link to="/listing/$id" params={{ id: l.id }} key={l.id} className="listing-card">
                  {photo ? (
                    <img src={photo} alt={l.title} className="listing-photo" loading="lazy" />
                  ) : (
                    <div className="listing-photo grid place-items-center text-muted-foreground">
                      <ImageOff size={40} />
                    </div>
                  )}
                  <div className="p-4">
                    <span className="text-xs text-primary font-semibold">{td('cat', l.category)}</span>
                    <h3 className="font-bold mt-2">{l.title}</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      {td('city', l.city)}, {l.district} · {t('card.places', { n: l.available_places })}
                    </p>
                    <p className="mt-4 font-bold">
                      {price(l.price)} {t('currency')}{' '}
                      <span className="font-normal text-muted-foreground text-sm">/ {td('period', l.payment_period)}</span>
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="section-heading">{t('cities.heading')}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t('cities.sub')}</p>
          </div>
          <MapPin className="text-primary hidden sm:block" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cityTiles.map(c => (
            <Button
              variant="ghost"
              key={c.city}
              className="city-tile"
              onClick={() => {
                navigate({ to: '/', search: { ...search, city: c.city } }).then(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }));
              }}
            >
              <img src={c.image} alt={t('cities.alt', { city: td('city', c.city) })} width={992} height={672} loading="lazy" />
              <span>{td('city', c.city)}</span>
            </Button>
          ))}
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-7 mt-12 pt-7 border-t border-border">
        {trust.map(x => (
          <div key={x.title} className="flex gap-3">
            <x.icon size={25} className="text-primary shrink-0" />
            <div>
              <h3 className="font-bold text-sm">{x.title}</h3>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{x.text}</p>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
