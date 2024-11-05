---
"@effect/docgen": patch
---

Support deeply nested namespaces.

Previously, the docgen would fail with a `[Markdown] Unsupported namespace nesting: 4` error. With this change all namespace headers at depth level 3 and above would be rendered using H4 elements.
