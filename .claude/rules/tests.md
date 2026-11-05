---
paths:
  - '**/*.spec.ts'
  - '**/*.spec.tsx'
---

# Tests

In test doubles, stub only what a test observes — if no assertion depends on a return value, vi.fn() is the whole mock.

Choose tests by the behavior and dependencies affected, including consumers of
shared code and contracts. Use native Playwright for permanent browser regression
coverage; temporary probe scenarios support exploration. Promote reusable
exploratory flows to native tests. See [Web testing standards](../../apps/web/STANDARDS.md#testing)
for the mocked and real-stack test layers.
