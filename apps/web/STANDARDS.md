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

## Auth

- Strategy interface: `AuthProvider` with `initialize`, `login`, `logout`, `getAccessToken`
- React context (`AuthContext`) + `useAuth()` hook
- Factory selects `FakeAuthProvider` (dev) vs real OIDC based on config

## i18n

- `i18next` + `react-i18next` with browser language detection
- Flat-key JSON files in `src/i18n/locales/{en,fr,es}.json`
- Fallback language: `fr`

## Testing

- Unit: `@testing-library/react` + vitest, colocated `*.spec.tsx`
- E2E: Playwright in `e2e/`, custom fixtures with `ApiMock` for deterministic API interception
- Mocks for `@/components` or design-system components go in `@/testing/mocks/components.tsx` so they can be reused across specs
