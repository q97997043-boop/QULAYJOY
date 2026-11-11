import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery, queryOptions, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { UserRound, CheckCircle2, Plus, Pencil, Pause, Play, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { pageHead } from '@/lib/marketplace';
import { useI18n } from '@/lib/i18n';
const options=queryOptions({queryKey:['my-profile'],queryFn:async()=>{const u=await supabase.auth.getUser();if(!u.data.user)throw new Error('AUTH_REQUIRED');const p=await supabase.from('profiles').select('*').eq('id',u.data.user.id).single();if(p.error)throw p.error;const l=await supabase.from('listings').select('*').eq('owner_id',u.data.user.id).order('created_at',{ascending:false});if(l.error)throw l.error;const avatar=p.data.avatar_path?await supabase.storage.from('listing-media').createSignedUrl(p.data.avatar_path,3600):null;return {profile:p.data,listings:l.data,user:u.data.user,avatar:avatar?.data?.signedUrl};}});
export const Route=createFileRoute('/_authenticated/profile')({head:()=>pageHead('Shaxsiy kabinet','Profilingiz va QULAYJOY e’lonlaringizni boshqaring.'),loader:({context})=>context.queryClient.ensureQueryData(options),component:Profile});
function Profile() {
  const { t, td, price } = useI18n();
  const { data } = useSuspenseQuery(options);
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('listings');

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    let avatar_path = data.profile.avatar_path;
    try {
      const file = f.get('avatar');
      if (file instanceof File && file.size) {
        if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) throw new Error(t('profile.avatarError'));
        avatar_path = `${data.user.id}/avatar-${crypto.randomUUID()}`;
        const up = await supabase.storage.from('listing-media').upload(avatar_path, file);
        if (up.error) throw up.error;
      }
      const r = await supabase
        .from('profiles')
        .update({ first_name: String(f.get('first_name')), last_name: String(f.get('last_name')), phone: String(f.get('phone')), avatar_path })
        .eq('id', data.user.id);
      if (r.error) throw r.error;
      await qc.invalidateQueries({ queryKey: ['my-profile'] });
      setMessage(t('profile.saved'));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('profile.saveError'));
    }
    setBusy(false);
  }

  async function change(id: string, status?: string) {
    if (!status && !window.confirm(t('profile.confirmDelete'))) return;
    const r = status ? await supabase.from('listings').update({ status }).eq('id', id) : await supabase.from('listings').delete().eq('id', id);
    if (r.error) {
      setMessage(r.error.message);
      return;
    }
    await qc.invalidateQueries();
  }

  return (
    <main className="page-width py-10">
      <div className="flex items-center gap-4 mb-8">
        {data.avatar ? (
          <img src={data.avatar} alt={t('profile.avatarAlt')} className="w-16 h-16 rounded-full object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-secondary grid place-items-center text-primary">
            <UserRound size={30} />
          </div>
        )}
        <div>
          <h1 className="section-heading">{data.profile.first_name || t('profile.fallbackTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{data.user.email}</p>
        </div>
      </div>
      <div className="flex gap-3 border-b border-border pb-4 mb-6">
        <Button variant={tab === 'listings' ? 'secondary' : 'ghost'} onClick={() => setTab('listings')}>
          {t('profile.myListings')}
        </Button>
        <Button variant={tab === 'profile' ? 'secondary' : 'ghost'} onClick={() => setTab('profile')}>
          {t('profile.info')}
        </Button>
      </div>
      {message && (
        <p role="status" className="notice mb-5">
          {message}
        </p>
      )}
      {tab === 'profile' ? (
        <form onSubmit={save} className="max-w-2xl space-y-5">
          <div className="form-grid">
            <label className="field">
              {t('auth.firstName')}
              <input name="first_name" defaultValue={data.profile.first_name} maxLength={80} required />
            </label>
            <label className="field">
              {t('auth.lastName')}
              <input name="last_name" defaultValue={data.profile.last_name} maxLength={80} required />
            </label>
            <label className="field">
              {t('auth.phone')}
              <input name="phone" defaultValue={data.profile.phone} type="tel" pattern="\+998[0-9]{9}" required />
            </label>
            <label className="field">
              {t('profile.avatar')}
              <input name="avatar" type="file" accept="image/*" />
            </label>
          </div>
          <p className="text-sm text-muted-foreground flex gap-2 items-center">
            <CheckCircle2 size={16} />
            {t('profile.emailStatus', { s: data.user.email_confirmed_at ? t('profile.confirmed') : t('profile.unconfirmed') })}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('profile.phoneStatus', { s: data.user.phone_confirmed_at ? t('profile.confirmed') : t('profile.smsPending') })}
          </p>
          <Button disabled={busy}>{busy ? t('new.saving') : t('profile.save')}</Button>
        </form>
      ) : (
        <>
          <div className="flex justify-between items-center gap-3 mb-6">
            <h2 className="text-xl font-bold">
              {t('profile.listingsHeading')} <span className="text-muted-foreground">({data.listings.length})</span>
            </h2>
            <Button asChild>
              <Link to="/new-listing">
                <Plus />
                {t('header.post')}
              </Link>
            </Button>
          </div>
          {!data.listings.length ? (
            <div className="empty-results">
              <h3 className="font-bold mb-2">{t('profile.noListings')}</h3>
              <p className="text-muted-foreground text-sm">{t('profile.noListingsHint')}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data.listings.map(l => {
                const toggleLabel = l.status === 'active' ? t('profile.pause') : t('profile.activate');
                return (
                  <article key={l.id} className="py-6 flex flex-wrap justify-between gap-4">
                    <div>
                      <h3 className="font-bold">{l.title}</h3>
                      <p className="text-sm text-muted-foreground mt-2">
                        {td('city', l.city)} · {price(l.price)} {t('currency')} / {td('period', l.payment_period)} ·{' '}
                        {l.status === 'active' ? t('status.active') : l.status === 'paused' ? t('status.paused') : t('status.draft')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button asChild variant="outline" size="icon" title={t('profile.edit')}>
                        <Link to="/new-listing" search={{ edit: l.id }} aria-label={t('profile.edit')}>
                          <Pencil />
                        </Link>
                      </Button>
                      <Button variant="outline" size="icon" title={toggleLabel} aria-label={toggleLabel} onClick={() => change(l.id, l.status === 'active' ? 'paused' : 'active')}>
                        {l.status === 'active' ? <Pause /> : <Play />}
                      </Button>
                      <Button variant="outline" size="icon" title={t('profile.delete')} aria-label={t('profile.delete')} onClick={() => change(l.id)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}
