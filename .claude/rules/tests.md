---
paths:
  - '**/*.spec.ts'
  - '**/*.spec.tsx'
  - '**/*.test.ts'
  - '**/*.test.tsx'
  - '**/*.e2e-spec.ts'
---

# Tests

In test doubles, stub only what a test observes — if no assertion depends on a return value, vi.fn() is the whole mock.

Choose tests by the behavior and dependencies affected, including consumers of
shared code and contracts.

For web tests, read [Web testing standards](../../apps/web/STANDARDS.md#testing).
