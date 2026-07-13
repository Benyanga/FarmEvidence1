import React, { createContext, useContext, useEffect, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import api from '../services/api';
import i18n from '../i18n';

const RoleContext = createContext(null);

export function RoleProvider({ children }) {
  const { user, isLoaded } = useUser();
  const [dbUser, setDbUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.post('/auth/sync-user', {
          displayName: user.fullName || user.username || ''
        });
        if (cancelled) return;
        setDbUser(data.user);
        if (data.user?.preferredLanguage) i18n.changeLanguage(data.user.preferredLanguage);
      } catch (err) {
        console.error('[RoleContext] sync-user failed', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, user]);

  const role = user?.publicMetadata?.role || dbUser?.role || null;

  return (
    <RoleContext.Provider value={{ dbUser, role, loading: loading || !isLoaded }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRoleContext() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRoleContext must be used within RoleProvider');
  return ctx;
}
