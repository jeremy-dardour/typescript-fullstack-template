---
paths:
  - 'apps/api/src/**/*.controller.ts'
---

# API controllers

Every route requires a token unless it is `@Public()`.
`src/__e2e-tests__/route-auth-coverage.e2e-spec.ts` checks both directions:
each non-public route must answer 401 without a token, and the public routes
must equal its `PUBLIC_ROUTES` list. Making a route public means adding it
there with a one-line reason. Never fix a failure in that spec by loosening
the spec itself.
