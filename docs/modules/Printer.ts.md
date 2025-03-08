---
title: Printer.ts
nav_order: 8
parent: Modules
---

## Printer.ts overview

Since v0.6.0

---

## Exports Grouped by Category

- [printers](#printers)
  - [printModule](#printmodule)
- [utils](#utils)
  - [prettify](#prettify)
  - [printFrontMatter](#printfrontmatter)

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

**Example** (Title 1)

```ts twoslash title="Title 1"
export const b: string = "b"
```

**Example** (Title 2)

```js twoslash title="Title 2"
export const c: string = "c"
```

**Throws**

`Error1` - Description 1
`Error2` - Description 2

**See**

- `foo` description1
- `printFunction` description2

**Signature**

```ts
declare const printModule: (module: Domain.Module) => Effect.Effect<string, never, Configuration.Configuration>
```

[Source](https://github.com/effect-ts/docgen/blob/main/src/Printer.ts#L323)

Since v0.6.0

# utils

## prettify

**Signature**

```ts
declare const prettify: (s: string) => Effect.Effect<string, never, never>
```

[Source](https://github.com/effect-ts/docgen/blob/main/src/Printer.ts#L375)

Since v0.6.0

## printFrontMatter

**Signature**

```ts
declare const printFrontMatter: (module: Domain.Module, nav_order: number) => string
```

[Source](https://github.com/effect-ts/docgen/blob/main/src/Printer.ts#L364)

Since v0.6.0
