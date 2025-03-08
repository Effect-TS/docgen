/**
 * @since 0.6.0
 */
import * as Array from "effect/Array"
import * as Effect from "effect/Effect"
import { identity, pipe } from "effect/Function"
import * as Order from "effect/Order"
import * as Record from "effect/Record"
import * as String from "effect/String"
import * as Prettier from "prettier"
import type * as Domain from "./Domain.js"

/** @internal */
export type Printable =
  | Domain.Class
  | Domain.Constant
  | Domain.Export
  | Domain.Function
  | Domain.Interface
  | Domain.TypeAlias
  | Domain.Namespace
  | Domain.Module

/**
 * @category CLI
 * @since 0.6.0
 */
const Markdown = {
  bold: (s: string) => `**${s}**`,
  fence: (content: string) => `\`\`\`ts\n${content}\n\`\`\`\n\n`,
  strikethrough: (content: string) => `~~${content}~~`
}

/**
 * Replaces the link from a JSDoc link tag with a simple text.
 *
 * Given "This is a description containing two links to {@link foo} and {@link bar baz}."
 * returns "This is a description containing two links to `foo` and `baz`."
 */
function replaceJSDocLinks(text: string): string {
  return text.replace(/\{@link\s+([^\s}]+)(?:\s+([^}]+))?\}/g, (_, link, label) => {
    // Use the label if provided; otherwise, use the link target
    return `\`${(label || link).trim()}\``
  })
}

const printOptionalDescription = (description: string | undefined): string => {
  if (description === undefined) {
    return ""
  }
  return `\n\n${replaceJSDocLinks(description)}`
}

const printArray = (title: string, ss?: ReadonlyArray<string>): string => {
  if (ss === undefined || ss.length === 0) {
    return ""
  }
  return `\n\n${Markdown.bold(title)}\n\n${ss.join("\n")}`
}

const printFence = (code: string): string => {
  if (code.startsWith("```ts") || code.startsWith("~~~ts")) {
    return code
  }
  return "```ts\n" + code + "\n```"
}

const printSignaturesArray = (signatures?: ReadonlyArray<string>): string => {
  if (signatures === undefined || signatures.length === 0) {
    return ""
  }
  return `\n\n${Markdown.bold("Signature")}\n\n${printFence(signatures.join("\n"))}`
}

const printThrowsArray = (throws?: ReadonlyArray<string>): string => printArray("Throws", throws)

const printExamplesArray = (examples: ReadonlyArray<string>): string => {
  if (examples.length === 0) {
    return ""
  }
  return examples.map((ex) => "\n\n**Example**\n\n" + printFence(ex)).join("")
}

const printOptionalSince = (since: ReadonlyArray<string>): string => {
  if (since.length === 0) {
    return ""
  }
  return `\n\nSince v${since.join(", ")}`
}

const printHeaderByIndentation = (indentation: number) => {
  switch (indentation) {
    case 0:
      return "## "
    case 1:
      return "### "
    default:
      return "#### "
  }
}

const printTitle = (s: string, deprecated: ReadonlyArray<string>, postfix?: string): string => {
  const name = s.trim() === "hasOwnProperty" ? `${s} (function)` : s
  const title = deprecated.length > 0 ? Markdown.strikethrough(name) : name
  return postfix === undefined ? title : title + ` ${postfix}`
}

const printSeesArray = (sees?: ReadonlyArray<string>): string => {
  if (sees === undefined || sees.length === 0) {
    return ""
  }
  return `\n\n${Markdown.bold("See")}\n\n${sees.map((see) => `- ${replaceJSDocLinks(see)}`).join("\n")}`
}

const printModel = (name: string, doc: Domain.Doc, options: {
  readonly indentation?: number
  readonly postfix?: string | undefined
  readonly signatures?: ReadonlyArray<string> | undefined
}): string => {
  return printHeaderByIndentation(options.indentation ?? 0) + printTitle(name, doc.deprecated, options.postfix) +
    printOptionalDescription(doc.description) +
    printThrowsArray(doc.throws) +
    printSeesArray(doc.sees) +
    printExamplesArray(doc.examples) +
    printSignaturesArray(options.signatures) +
    printOptionalSince(doc.since)
}

const printStaticMethod = (model: Domain.Method): string => {
  return printModel(model.name, model.doc, {
    indentation: 1,
    postfix: "(static method)",
    signatures: model.signatures
  })
}

const printMethod = (model: Domain.Method): string => {
  return printModel(model.name, model.doc, {
    indentation: 1,
    postfix: "(method)",
    signatures: model.signatures
  })
}

const printProperty = (model: Domain.Property): string => {
  return printModel(model.name, model.doc, {
    indentation: 1,
    postfix: "(property)",
    signatures: [model.signature]
  })
}

/** @internal */
export const printFrontMatter = (module: Domain.Module, order: number): string => {
  return `---
title: ${module.name}
nav_order: ${order}
parent: Modules
---`
}

const addLineBreak = (i: number): string => i === 0 ? "\n\n" : ""

/** @internal */
export const printClass = (model: Domain.Class): string => {
  const header = printModel(model.name, model.doc, {
    postfix: "(class)",
    signatures: [model.signature]
  })
  return header +
    model.staticMethods.map((method, i) => addLineBreak(i) + printStaticMethod(method)).join("\n\n") +
    model.methods.map((method, i) => addLineBreak(i) + printMethod(method)).join("\n\n") +
    model.properties.map((property, i) => addLineBreak(i) + printProperty(property)).join("\n\n")
}

/** @internal */
export const printConstant = (model: Domain.Constant): string => {
  return printModel(model.name, model.doc, {
    signatures: [model.signature]
  })
}

/** @internal */
export const printExport = (model: Domain.Export): string => {
  return printModel(model.name, model.doc, {
    postfix: model.isNamespaceExport ? "(namespace export)" : undefined,
    signatures: [model.signature]
  })
}

/** @internal */
export const printFunction = (model: Domain.Function): string => {
  return printModel(model.name, model.doc, {
    signatures: model.signatures
  })
}

/** @internal */
export const printInterface = (model: Domain.Interface, indentation: number): string => {
  return printModel(model.name, model.doc, {
    indentation,
    postfix: "(interface)",
    signatures: [model.signature]
  })
}

/** @internal */
export const printTypeAlias = (model: Domain.TypeAlias, indentation: number): string => {
  return printModel(model.name, model.doc, {
    indentation,
    postfix: "(type alias)",
    signatures: [model.signature]
  })
}

/** @internal */
export const printNamespace = (model: Domain.Namespace, indentation: number): string => {
  const header = printModel(model.name, model.doc, {
    indentation,
    postfix: "(namespace)"
  })
  return header + "\n\n" +
    model.interfaces.map((inter) => printInterface(inter, indentation + 1) + "\n\n").join("") +
    model.typeAliases.map((typeAlias) => printTypeAlias(typeAlias, indentation + 1) + "\n\n").join("") +
    model.namespaces.map((namespace) => printNamespace(namespace, indentation + 1) + "\n\n").join("")
}

/** @internal */
export const print = (p: Printable): string => {
  switch (p._tag) {
    case "Class":
      return printClass(p)
    case "Constant":
      return printConstant(p)
    case "Export":
      return printExport(p)
    case "Function":
      return printFunction(p)
    case "Interface":
      return printInterface(p, 0)
    case "TypeAlias":
      return printTypeAlias(p, 0)
    case "Namespace":
      return printNamespace(p, 0)
    case "Module":
      return printModule(p)
  }
}

const DEFAULT_CATEGORY = "utils"

const byCategory = Order.mapInput(
  String.Order,
  ([category]: [string, ...Array<unknown>]) => category
)

const getPrintables = (module: Domain.Module): ReadonlyArray<Printable> =>
  Array.flatten([
    module.classes,
    module.constants,
    module.exports,
    module.functions,
    module.interfaces,
    module.typeAliases,
    module.namespaces
  ])

const sortByName: <A extends { name: string }>(self: Iterable<A>) => Array<A> = Array.sort(
  pipe(
    String.Order,
    Order.mapInput(({ name }: { name: string }) => name)
  )
)

/**
 * Description...
 *
 * ```ts
 * export const a: string = "a"
 * ```
 *
 * ```text
 * ┌───────┐    ┌───────┐    ┌───────┐    ┌───────┐    ┌───────┐    ┌────────┐
 * │ input │───►│ func1 │───►│ func2 │───►│  ...  │───►│ funcN │───►│ result │
 * └───────┘    └───────┘    └───────┘    └───────┘    └───────┘    └────────┘
 * ```
 *
 * **Example** (Title 1)
 *
 * ```ts twoslash title="Title 1"
 * import { Domain, Printer } from "@effect/docgen"
 * import { Option } from "effect"
 *
 * const doc = new Domain.Doc(undefined, ["1.0.0"], [], [], [], [], [], {})
 * const m = new Domain.Module("tests", doc, ["src", "tests.ts"], [], [], [], [], [], [], [])
 * console.log(Printer.printModule(m))
 * ```
 *
 * **Example** (Title 2)
 *
 * ~~~js twoslash title="Title 2"
 * export const a: string = "b"
 * ~~~
 *
 * @throws `Error1` - Description 1
 * @throws `Error2` - Description 2
 *
 * @see `foo` description1
 * @see {@link printFunction} description2
 *
 * @category printers
 * @since 0.6.0
 */
export const printModule = (module: Domain.Module) => {
  const description = printModel(module.name, module.doc, {
    postfix: "overview"
  })

  const content = pipe(
    sortByName(getPrintables(module)),
    Array.groupBy((printable) =>
      printable.doc.category.length === 0 ? DEFAULT_CATEGORY : printable.doc.category.join(", ")
    ),
    Record.toEntries,
    Array.sort(byCategory),
    Array.map(([category, printables]) =>
      [
        `\n# ${category}\n`,
        ...pipe(
          printables,
          Array.sort(
            Order.mapInput(
              String.Order,
              (printable: Printable) => printable.name
            )
          ),
          Array.map(print)
        )
      ].join("\n")
    )
  ).join("\n")

  return `
${description}

<!-- toc -->
${content}
`
}

const defaultPrettierOptions: Prettier.Options = {
  parser: "markdown",
  semi: false,
  singleQuote: false,
  printWidth: 120,
  trailingComma: "none"
}

/**
 * @since 0.6.0
 */
export function prettify(s: string) {
  return Effect.tryPromise({
    try: () => Prettier.format(s, defaultPrettierOptions),
    catch: identity
  }).pipe(Effect.orDie)
}
