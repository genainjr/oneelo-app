'use client';

import { createContext, useContext } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AuthUser } from '@/types';

type AuthUserContextValue = {
  user: AuthUser | null;
  setUser: Dispatch<SetStateAction<AuthUser | null>>;
};

const AuthUserContext = createContext<AuthUserContextValue | null>(null);

export const AuthUserProvider = AuthUserContext.Provider;

export function useAuthUser() {
  const context = useContext(AuthUserContext);
  if (!context) {
    throw new Error('useAuthUser deve ser usado dentro de AuthUserProvider.');
  }
  return context;
}
