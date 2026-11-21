import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { LanguageCode, UserProfile, WebsiteSettings } from '../types/academy';
import { apiRequest, setAuthToken } from '../lib/api';

interface AppContextValue {
  user: UserProfile | null;
  settings: WebsiteSettings | null;
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  currentPath: string;
  navigate: (to: string) => void;
  needsAdminSetup: boolean;
  loadingBootstrap: boolean;
  setSession: (token: string, user: UserProfile) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  refreshBootstrapStatus: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<WebsiteSettings | null>(null);
  const [lang, setLang] = useState<LanguageCode>('en');
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || '/');
  const [needsAdminSetup, setNeedsAdminSetup] = useState<boolean>(false);
  const [loadingBootstrap, setLoadingBootstrap] = useState<boolean>(true);

  const navigate = useCallback((to: string) => {
    if (to === window.location.pathname + window.location.search) return;
    window.history.pushState({}, '', to);
    setCurrentPath(to);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setCurrentPath(window.location.pathname + window.location.search);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const res = await apiRequest<{ settings: WebsiteSettings }>('/api/public/settings/public');
      setSettings(res.settings);
      const root = document.documentElement;
      if (res.settings.primary_color) {
        root.style.setProperty('--brand-primary', res.settings.primary_color);
      }
      if (res.settings.accent_color) {
        root.style.setProperty('--brand-accent', res.settings.accent_color);
      }
      if (res.settings.site_name) {
        document.title = `${res.settings.site_name} — Online Learning & Mentorship`;
      }
      if (res.settings.favicon_url) {
        let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = res.settings.favicon_url;
      }
    } catch {
      // ignore initial failure gracefully
    }
  }, []);

  const refreshBootstrapStatus = useCallback(async () => {
    try {
      const res = await apiRequest<{ needsAdminSetup: boolean }>('/api/auth/bootstrap-status');
      setNeedsAdminSetup(res.needsAdminSetup);
    } catch {
      setNeedsAdminSetup(false);
    } finally {
      setLoadingBootstrap(false);
    }
  }, []);

  useEffect(() => {
    void refreshSettings();
    void refreshBootstrapStatus();
  }, [refreshSettings, refreshBootstrapStatus]);

  const setSession = useCallback((token: string, nextUser: UserProfile) => {
    setAuthToken(token);
    setUser(nextUser);
    if (nextUser.preferred_language === 'bn' || nextUser.preferred_language === 'en') {
      setLang(nextUser.preferred_language);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await apiRequest<{ user: UserProfile }>('/api/auth/me');
      setUser(res.user);
    } catch {
      setAuthToken(null);
      setUser(null);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setAuthToken(null);
    setUser(null);
    navigate('/');
  }, [navigate]);

  return (
    <AppContext.Provider
      value={{
        user,
        settings,
        lang,
        setLang,
        currentPath,
        navigate,
        needsAdminSetup,
        loadingBootstrap,
        setSession,
        logout,
        refreshUser,
        refreshSettings,
        refreshBootstrapStatus,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
