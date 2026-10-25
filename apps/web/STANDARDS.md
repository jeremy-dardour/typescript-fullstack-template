# Standards: Web

Inherits: [Global standards](../../STANDARDS.md)

## Feature structure

```
src/
  features/       → Feature folders by domain
    <feature>/    → Page component + components, one file each, flat —
                    except that a composite component and its subcomponents
                    share one folder named after the composite, and a
                    reusable subsystem the feature hosts (components plus
                    their derivations) shares one folder named after the
                    subsystem. A component used by several parents is
                    shared, not a subcomponent: it stays at the feature
                    root. No barrel/index files.
  components/ui/  → shadcn/ui primitives
  app/components/ → App-level components (layout, error boundaries)
  api/            → API client and hooks
  auth/           → Auth provider (strategy pattern + React context)
  i18n/           → Translations (i18next, JSON files per locale)
```

## Components

- Function components with named exports
- UI primitives in `src/components/ui/` (shadcn/ui)
- App-level components in `src/app/components/`
- `react-refresh/only-export-components` forbids non-component exports from
  component files — hooks, predicates, and constants shared with a component
  get their own module rather than an eslint-disable

## API layer

- `openapi-react-query` wraps `openapi-fetch` for typed hooks from OpenAPI spec
- Query hooks: thin wrappers in `src/api/hooks/` around `$api.useQuery`/`$api.useMutation`
- Auth middleware in `src/api/middlewares/` injects bearer token
- Access generated schemas with indexed types such as
  `components['schemas']['ItemDto']`. Do not use dotted access through a type
  alias; it can silently resolve to `any`.
- **API types stay in the API layer.** Feature components never import from
  `@/types/openapi` directly. Each hook file re-exports named type aliases
  (e.g. `Item`) from the generated DTOs. Components and tests import those
  aliases. If the API contract changes, only the hook file adjusts the
  mapping.
- **One derived lookup, passed down.** When a query returns a flat list that
  multiple children look up by ID (e.g. `usersById`), compute the `Map` once
  in the nearest common parent and pass it as a prop — do not recompute in
  each child.
- Store selected entity IDs, then derive the selected entity from query data;
  do not keep a copied response object that can become stale.
- Mutations invalidate or patch only the queries whose response can change.
- Query and mutation errors open the global error dialog, except a 401 (the
  session ends and the sign-in page replaces the screen) and query statuses
  listed in `meta.localErrorStatuses`, which the screen renders itself.
  Mutations have no such opt-out: handle an expected mutation error in the
  `mutate(…, { onError })` callback and let the dialog cover the rest.
- The query cache is cleared when the session ends, so cached data never
  outlives the user who fetched it.

## Auth

- `AuthSystem` = `AuthSession` (state, token, sign-out) + `SignInButton`;
  module boundaries and how to add a provider:
  [ADR 0008](../../docs/adr/0008-web-auth-module-boundaries.md)
- `useAuth()` for session actions, `useAuthState()` for state,
  `<SignInButton />` to start a sign-in
- `createAuthSystem()` binds the fake adapter when `VITE_FAKE_AUTH=true` and
  throws otherwise

## i18n

- `i18next` + `react-i18next` with browser language detection
- Flat-key JSON files in `src/i18n/locales/{en,fr,es}.json`
- Fallback language: `fr`

## Testing

- **Integration** (main layer): `renderWithApp` with the real providers and
  HTTP mocked by MSW. Do not mock hooks, the query layer, or internal
  components. See `src/testing/render-with-app.tsx` and
  `src/testing/mock-api.ts`; `features/items/__tests__/items-page.spec.tsx` is
  the reference.
- **Unit** (`*.spec.tsx`, colocated): pure functions and components with
  branching logic. Skip structural components — integration tests cover them.
- MSW responses must match the real API contract, including RFC 9457 Problem
  Details fields (`problemResponse()`). Unhandled requests fail the test.
- For journeys across several requests and server-side state changes, use a
  stateful adapter (`setupItemsApi()`) instead of repeating raw handlers.
- **E2E**: Playwright in `e2e/` against the production build with the API
  mocked. To check behavior against the real running app, use the probe
  runner (`pnpm probe`, see the `verify-app` skill).
