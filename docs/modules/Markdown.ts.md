---
title: Markdown.ts
nav_order: 7
parent: Modules
---

## Markdown overview

Since v0.6.0

---

<h2 class="text-delta">Table of contents</h2>

- [printers](#printers)
  - [printModule](#printmodule)

---

# printers

## printModule

Description...

```ts
export const a: string = "a"
```

```text
┌───────┐    ┌───────┐    ┌───────┐    ┌───────┐    ┌───────┐    ┌────────┐
│ input │───►│ func1 │───►│ func2 │───►│  ...  │───►│ funcN │───►│ result │
└───────┘    └───────┘    └───────┘    └───────┘    └───────┘    └────────┘
```

**Throws**

- `Error1` - Description 1
- `Error2` - Description 2

**Example** (Title 1)

```ts twoslash title="Title 1"
import { Domain, Markdown } from "@effect/docgen"
import { Option } from "effect"

const doc = new Domain.NamedDoc("tests", Option.none(), Option.some("1.0.0"), false, [], Option.none())
const m = new Domain.Module(doc, ["src", "tests.ts"], [], [], [], [], [], [], [])
console.log(Markdown.printModule(m, 0))
```

**Example** (Title 2)

```js twoslash title="Title 2"
export const a: string = "b"
```

**Signature**

```ts
export declare const printModule: (module: Domain.Module, order: number) => Effect.Effect<string>
```

Since v0.6.0
