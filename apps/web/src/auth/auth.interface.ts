import type { AuthState } from '@/auth/auth-state';
import type { ComponentType } from 'react';

export type AuthChangeListener = () => void;

/**
 * The authenticated-session lifecycle: exposes the current state, supplies the
 * bearer token, and ends the session. One instance lives for the whole app and
 * reports `anonymous` between sessions.
 *
 * `getState()` must return the same reference until the state changes: it
 * feeds `useSyncExternalStore`, which re-renders forever on a fresh object.
 */
export interface AuthSession {
  getState(): AuthState;
  subscribe(listener: AuthChangeListener): () => void;
  signOut(): void;
  getAccessToken(): Promise<string>;
}

/**
 * A complete auth adapter. Signing in is a component rather than a method
 * because some providers must render their own button (Google, Apple), while
 * redirect or popup providers simply start their flow on click.
 */
export interface AuthSystem {
  session: AuthSession;
  SignInButton: ComponentType;
}
