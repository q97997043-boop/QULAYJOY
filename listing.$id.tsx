import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery, queryOptions } from '@tanstack/react-query';
import { useMemo } from 'react';
import { MapPin, BedDouble, UsersRound, ArrowLeft, ShieldCheck, ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPublicListings } from '@/lib/listings.functions';
import { pageHead, listingPoint } from '@/lib/marketplace';
import { useI18n } from '@/lib/i18n';
import { ListingsMap } from '@/components/location-map';
const options=(id:string)=>queryOptions({queryKey:['listing',id],queryFn:()=>getPublicListings({data:{id}})});
export const Route=createFileRoute('/listing/$id')({head:()=>pageHead('Turar joy tafsilotlari','QULAYJOY’da turar joy rasmlari, narxi, qulayliklari va bo‘sh joylari bilan tanishing.'),loader:({params,context})=>context.queryClient.ensureQueryData(options(params.id)),component:Detail});
function Detail() {
  const { id } = Route.useParams();
  const { t, td, price } = useI18n();
  const { data } = useSuspenseQuery(options(id));
  const listing = data[0];
  const point = listing ? listingPoint(listing) : null;
  const mapItems = useMemo(
    () =>
      listing && point
        ? [{ ...point, title: listing.title, subtitle: `${td('city', listing.city)}${listing.district ? `, ${listing.district}` : ''}`, price: `${price(listing.price)} ${t('currency')} / ${td('period', listing.payment_period)}` }]
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listing, t, td, price],
  );

  if (!listing)
    return (
      <main className="page-width py-16">
        <h1 className="section-heading">{t('detail.notFound')}</h1>
        <p className="text-muted-foreground mt-4">{t('detail.notFoundText')}</p>
        <Button asChild className="mt-6">
          <Link to="/">{t('detail.back')}</Link>
        </Button>
      </main>
    );

  return (
    <main className="page-width py-8">
      <Link to="/" className="text-sm text-primary inline-flex items-center gap-2">
        <ArrowLeft size={16} />
        {t('nav.listings')}
      </Link>
      <div className="mt-6 flex flex-wrap justify-between gap-4">
        <div>
          <span className="text-xs text-primary font-bold">{td('cat', listing.category)}</span>
          <h1 className="section-heading mt-2">{listing.title}</h1>
          <p className="flex items-center gap-1 text-sm text-muted-foreground mt-3">
            <MapPin size={16} />
            {td('city', listing.city)}, {listing.district}
          </p>
        </div>
        <p className="text-2xl font-bold">
          {price(listing.price)} {t('currency')}
          <span className="text-sm text-muted-foreground font-normal"> / {td('period', listing.payment_period)}</span>
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-4 mt-7">
        {listing.media.length ? (
          listing.media.map(m =>
            m.url &&
            (m.media_type === 'video' ? (
              <video key={m.id} src={m.url} controls className="w-full aspect-video bg-muted rounded-md" />
            ) : (
              <img key={m.id} src={m.url} alt={listing.title} className="w-full aspect-video object-cover rounded-md" />
            )),
          )
        ) : (
          <div className="aspect-video bg-muted grid place-items-center text-muted-foreground">
            <ImageOff size={45} />
          </div>
        )}
      </div>
      <div className="grid lg:grid-cols-[1fr_320px] gap-10 mt-8">
        <div>
          <div className="flex flex-wrap gap-6 text-sm pb-6 border-b border-border">
            <span className="inline-flex items-center gap-2">
              <BedDouble size={19} />
              {t('detail.rooms', { n: listing.rooms })}
            </span>
            <span className="inline-flex items-center gap-2">
              <UsersRound size={19} />
              {t('detail.freePlaces', { n: listing.available_places })}
            </span>
            {listing.floor != null && <span>{t('detail.floor', { n: listing.floor })}</span>}
            {listing.room_number && <span>{t('detail.roomNo', { n: listing.room_number })}</span>}
          </div>
          <h2 className="text-xl font-bold mt-7">{t('detail.about')}</h2>
          <p className="mt-4 text-sm leading-7 whitespace-pre-wrap">{listing.description}</p>
          {listing.amenities.length > 0 && (
            <>
              <h2 className="text-xl font-bold mt-7">{t('detail.amenities')}</h2>
              <div className="flex flex-wrap gap-3 mt-4">
                {listing.amenities.map(a => (
                  <span key={a} className="text-sm bg-secondary px-3 py-2 rounded-md">
                    {td('amenity', a)}
                  </span>
                ))}
              </div>
            </>
          )}
          {listing.house_rules && (
            <>
              <h2 className="text-xl font-bold mt-7">{t('detail.rules')}</h2>
              <p className="mt-3 text-sm whitespace-pre-wrap">{listing.house_rules}</p>
            </>
          )}
          {listing.available_from && (
            <p className="mt-6 text-sm">
              {t('detail.availableFrom', { d: listing.available_from })}
              {listing.available_to ? t('detail.availableTo', { d: listing.available_to }) : ''}
            </p>
          )}
          {point && (
            <>
              <h2 className="text-xl font-bold mt-7 mb-4">{t('map.location')}</h2>
              <ListingsMap items={mapItems} height={360} maxZoom={point.approx ? 11 : 16} />
              {point.approx && <p className="text-xs text-muted-foreground mt-2">{t('map.approx')}</p>}
              {listing.address && <p className="text-sm mt-2">{listing.address}</p>}
            </>
          )}
        </div>
        <aside className="border-t border-border pt-6">
          <div className="flex gap-2 text-primary mb-3">
            <ShieldCheck size={20} />
            <h2 className="font-bold">{t('detail.contactTitle')}</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-6">{t('detail.contactText')}</p>
          <p className="notice mt-5">{t('detail.stageNotice')}</p>
        </aside>
      </div>
    </main>
  );
}
