'use client';

import { createContext, useContext } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AuthUser } from '@/types';

export type AuthUserContextValue = {
  user: AuthUser | null;
  setUser: Dispatch<SetStateAction<AuthUser | null>>;
  loadingUser: boolean;
  refreshUser: () => Promise<AuthUser | null>;
};

const defaultContextValue: AuthUserContextValue = {
  user: null,
  setUser: () => {},
  loadingUser: false,
  refreshUser: async () => null,
};

const AuthUserContext = createContext<AuthUserContextValue>(defaultContextValue);

export const AuthUserProvider = AuthUserContext.Provider;

export function useAuthUser() {
  return useContext(AuthUserContext);
}
