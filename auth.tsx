import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { pageHead } from '@/lib/marketplace';
import { useI18n } from '@/lib/i18n';
export const Route=createFileRoute('/auth')({head:()=>pageHead('Kirish va ro‘yxatdan o‘tish','QULAYJOY hisobingizga kiring yoki bepul ro‘yxatdan o‘ting.'),component:Auth});
function Auth() {
  const { t } = useI18n();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const qc = useQueryClient();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: '/profile' });
    });
  }, [navigate]);
  function switchMode(next: typeof mode) {
    setMode(next);
    setError('');
    setMessage('');
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const f = new FormData(e.currentTarget);
    const email = String(f.get('email'));
    const password = String(f.get('password') ?? '');
    try {
      if (mode === 'forgot') {
        const r = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' });
        if (r.error) throw r.error;
        setMessage(t('auth.resetSent'));
      } else if (mode === 'signup') {
        const r = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { first_name: String(f.get('first_name')), last_name: String(f.get('last_name')), phone: String(f.get('phone')) },
          },
        });
        if (r.error) throw r.error;
        if (!r.data.session) setMessage(t('auth.confirmSent'));
        else {
          await qc.invalidateQueries();
          await navigate({ to: '/profile' });
        }
      } else {
        const r = await supabase.auth.signInWithPassword({ email, password });
        if (r.error) throw r.error;
        await qc.invalidateQueries();
        await navigate({ to: '/profile' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.error'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page-width">
      <div className="max-w-md mx-auto py-14">
        <span className="text-primary text-sm font-semibold">{t('auth.account')}</span>
        <h1 className="section-heading mt-3">{mode === 'signup' ? t('auth.titleSignup') : mode === 'forgot' ? t('auth.titleForgot') : t('auth.titleLogin')}</h1>
        <p className="text-muted-foreground text-sm mt-3 mb-7">{t('tagline')}</p>
        {mode !== 'forgot' && (
          <div className="flex border-b border-border mb-6">
            <Button variant={mode === 'login' ? 'secondary' : 'ghost'} className="flex-1" onClick={() => switchMode('login')}>
              {t('auth.login')}
            </Button>
            <Button variant={mode === 'signup' ? 'secondary' : 'ghost'} className="flex-1" onClick={() => switchMode('signup')}>
              {t('auth.signup')}
            </Button>
          </div>
        )}
        <form onSubmit={submit} className="space-y-5">
          {mode === 'signup' && (
            <>
              <div className="form-grid">
                <label className="field">
                  {t('auth.firstName')}
                  <input name="first_name" required maxLength={80} autoComplete="given-name" />
                </label>
                <label className="field">
                  {t('auth.lastName')}
                  <input name="last_name" required maxLength={80} autoComplete="family-name" />
                </label>
              </div>
              <label className="field">
                {t('auth.phone')}
                <input name="phone" type="tel" pattern="\+998[0-9]{9}" placeholder="+998901234567" required autoComplete="tel" />
              </label>
            </>
          )}
          <label className="field">
            {t('auth.email')}
            <input name="email" type="email" required maxLength={255} autoComplete="email" placeholder="siz@example.com" />
          </label>
          {mode !== 'forgot' && (
            <label className="field">
              {t('auth.password')}
              <input name="password" type="password" required minLength={8} maxLength={128} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
            </label>
          )}
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="notice">
              {message}
            </p>
          )}
          <Button className="w-full h-12" disabled={busy}>
            {busy ? t('auth.busy') : mode === 'signup' ? t('auth.createAccount') : mode === 'forgot' ? t('auth.sendLink') : t('auth.login')}
            <ArrowRight />
          </Button>
        </form>
        <Button variant="link" className="mt-4" onClick={() => switchMode(mode === 'forgot' ? 'login' : 'forgot')}>
          {mode === 'forgot' ? t('auth.backToLogin') : t('auth.forgot')}
        </Button>
        <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck size={16} />
          {t('auth.phonePrivate')}
        </div>
      </div>
    </main>
  );
}
