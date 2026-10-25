# ADR 0008: Web auth is a session plus a sign-in component

**Status:** Accepted — 2026-10

## Decision

The web app talks to authentication through one composed object:

```ts
interface AuthSystem {
  session: AuthSession; // getState, subscribe, signOut, getAccessToken
  SignInButton: React.ComponentType;
}
```

- `AuthSession` owns the session lifecycle: observable state
  (`restoring | anonymous | authenticated | error`), the bearer token, and
  sign-out. It lives for the whole app and reports `anonymous` between
  sessions. Components read it with `useAuthState()`
  (`useSyncExternalStore`), so the context value stays stable.
- Signing in is a **component**, not a `signIn()` method. Some identity
  providers must render their own button (Google Identity Services, Sign in
  with Apple); redirect and popup providers (Auth0, Okta, Keycloak, Entra ID,
  `oidc-client-ts`) start their flow from a plain button. A component covers
  both; a method cannot express the first.
- `ProtectedRoute` renders a landing page with `<SignInButton />` when the
  session is not authenticated. It never starts a sign-in on its own, so a
  failing provider cannot cause a redirect loop.
- Only a `401` from the API ends the session. A `403` is an ordinary
  permission denial.
- When the session ends, the query cache and any open error are cleared, so
  the next user of the tab never sees the previous user's data.
- `createAuthSystem()` returns the fake adapter when `VITE_FAKE_AUTH=true` and
  throws otherwise: the template ships no real adapter, and failing loudly
  beats sending fake tokens to an API that rejects them.

## Adding a real provider

Implement `AuthSession` for the provider and return it from
`createAuthSystem()` with its sign-in component. Keep `getState()` returning
the same object until the state changes — `useSyncExternalStore` re-renders
forever on a fresh object. A redirect provider handles its callback while in
`restoring` and settles on `authenticated` or `anonymous`.

## Constraint

`FakeAuthProvider` makes no network call. Web e2e runs with the API mocked,
so a real request from the auth layer would break it.

## Out of scope

Cookie-session (backend-for-frontend) auth has no bearer token, so
`getAccessToken()` would not apply. The API is bearer-JWT only; moving to
cookie sessions changes the API and the auth middleware as well.
