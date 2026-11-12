---
paths:
  - '**/*.spec.ts'
  - '**/*.spec.tsx'
  - '**/*.test.ts'
  - '**/*.test.tsx'
  - '**/*.e2e-spec.ts'
---

# Tests

For unit spies, stub only the behavior the exercised code observes. A spy that is only checked for calls can be a bare `vi.fn()`; a return value the code consumes needs a valid stub even when no assertion inspects it.

Choose tests by the behavior and dependencies affected, including consumers of
shared code and contracts.

For web tests, read [Web testing standards](../../apps/web/STANDARDS.md#testing).
