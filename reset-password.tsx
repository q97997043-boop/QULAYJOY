import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { pageHead } from '@/lib/marketplace';
import { useI18n } from '@/lib/i18n';
export const Route=createFileRoute('/reset-password')({head:()=>pageHead('Yangi parol','QULAYJOY hisobingiz uchun yangi parol o‘rnating.'),component:Reset});
function Reset() {
  const { t } = useI18n();
  const [valid, setValid] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setValid(new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery');
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get('password'));
    if (password !== f.get('confirm')) {
      setMessage(t('reset.mismatch'));
      return;
    }
    setBusy(true);
    const r = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (r.error) setMessage(r.error.message);
    else setDone(true);
  }
  return (
    <main className="page-width py-14">
      <div className="max-w-md mx-auto">
        <h1 className="section-heading mb-7">{t('reset.title')}</h1>
        {done ? (
          <>
            <p className="notice mb-5">{t('reset.done')}</p>
            <Button asChild>
              <Link to="/profile">{t('reset.toCabinet')}</Link>
            </Button>
          </>
        ) : valid ? (
          <form onSubmit={submit} className="space-y-5">
            <label className="field">
              {t('reset.newPassword')}
              <input type="password" name="password" minLength={8} required autoComplete="new-password" />
            </label>
            <label className="field">
              {t('reset.repeat')}
              <input type="password" name="confirm" minLength={8} required autoComplete="new-password" />
            </label>
            {message && (
              <p role="alert" className="text-destructive">
                {message}
              </p>
            )}
            <Button disabled={busy}>{t('reset.save')}</Button>
          </form>
        ) : (
          <>
            <p className="notice mb-5">{t('reset.openLink')}</p>
            <Button asChild variant="outline">
              <Link to="/auth">{t('auth.backToLogin')}</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
