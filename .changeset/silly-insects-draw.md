---
"@effect/docgen": minor
---

- Remove fences from Example type and update related parsing and generation logic
- Remove unnecessary assert import handling in Core module
- Change "Added in" to "Since" in Markdown generation
- Reorder signature and example sections in Markdown generation
- Remove redundant "Example" header in Markdown generation
- runExamples is not false by default
- Extract examples from descriptions (disable with `skip-type-checking` metadata on fenced code blocks)
- Add support for `@throws` tag in documentation generation
- Refactor Domain module to use class-based implementation
- Remove File module and integrate File class into Domain module
- Move DocgenError from Error module to Domain module
- Integrate Process service into Domain module
- Rename Markdown module to Printer and update related imports
- Remove Option usage in Domain
- Remove NamedDoc class and update Domain model constructors
- Add support for @see JSDoc tag in function documentation
