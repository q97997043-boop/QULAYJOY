import { Link, useRouter, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Home, Plus, UserRound, LogOut, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { LANGS, LANG_LABELS, isLang, useI18n } from '@/lib/i18n';

export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();
  return (
    <label className="inline-flex items-center gap-1 text-muted-foreground" title={t('lang.label')}>
      <Globe size={16} aria-hidden />
      <select
        className="lang-select"
        aria-label={t('lang.label')}
        value={lang}
        onChange={e => {
          if (isLang(e.target.value)) setLang(e.target.value);
        }}
      >
        {LANGS.map(l => (
          <option key={l} value={l}>
            {LANG_LABELS[l]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SiteHeader() {
  const { t } = useI18n();
  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const r = await supabase.auth.getUser();
      return r.data.user;
    },
    retry: false,
  });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  async function logout() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await router.invalidate();
    await navigate({ to: '/auth', replace: true });
  }
  return (
    <header className="site-header">
      <div className="page-width flex items-center justify-between gap-4">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Home size={23} />
          </span>
          qulayjoy<span className="text-highlight">.</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          <Link to="/" className="nav-link active">
            {t('nav.listings')}
          </Link>
          <Link to="/" search={{ category: 'roommate' }} className="nav-link">
            {t('nav.roommate')}
          </Link>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <Button variant="outline" asChild className="hidden sm:inline-flex h-10">
            <Link to="/new-listing">
              <Plus />
              {t('header.post')}
            </Link>
          </Button>
          {user ? (
            <>
              <Button variant="ghost" asChild>
                <Link to="/profile">
                  <UserRound />
                  <span className="hidden sm:inline">{t('header.cabinet')}</span>
                </Link>
              </Button>
              <Button variant="ghost" size="icon" aria-label={t('header.logout')} title={t('header.logout')} onClick={logout}>
                <LogOut />
              </Button>
            </>
          ) : (
            <Button variant="ghost" asChild>
              <Link to="/auth">
                <UserRound />
                {t('header.login')}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
