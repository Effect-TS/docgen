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
import * as Configuration from "./Configuration.js"
import type * as Domain from "./Domain.js"
import * as Parser from "./Parser.js"

/** @internal */
export type Printable =
  | Domain.Class
  | Domain.Constant
  | Domain.Export
  | Domain.Function
  | Domain.Interface
  | Domain.TypeAlias
  | Domain.Namespace

const Markdown = {
  bold: (content: string) => `**${content}**`,
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

const printOptionalSignature = (signature?: string): string => {
  if (signature === undefined) {
    return ""
  }
  return `\n\n${Markdown.bold("Signature")}\n\n${printFence(signature)}`
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

const printOptionalSourceLink = (position?: Domain.Position) => {
  return Effect.gen(function*() {
    if (position === undefined) {
      return ""
    }
    const config = yield* Configuration.Configuration
    const source = yield* Parser.Source
    const name = source.sourceFile.getBaseName()
    return `\n\n[Source](${config.projectHomepage}/blob/main/src/${name}#L${position.line})`
  })
}

const printModel = (name: string, doc: Domain.Doc, options: {
  readonly indentation?: number
  readonly postfix?: string | undefined
  readonly signature?: string | undefined
  readonly position?: Domain.Position | undefined
}) => {
  return Effect.gen(function*() {
    const sourceLink = yield* printOptionalSourceLink(options.position)
    return printHeaderByIndentation(options.indentation ?? 0) + printTitle(name, doc.deprecated, options.postfix) +
      printOptionalDescription(doc.description) +
      printThrowsArray(doc.throws) +
      printExamplesArray(doc.examples) +
      printSeesArray(doc.sees) +
      printOptionalSignature(options.signature) +
      sourceLink +
      printOptionalSince(doc.since)
  })
}

const printStaticMethod = (model: Domain.Method) => {
  return printModel(model.name, model.doc, {
    indentation: 1,
    postfix: "(static method)",
    signature: model.signature
  })
}

const printMethod = (model: Domain.Method) => {
  return printModel(model.name, model.doc, {
    indentation: 1,
    postfix: "(method)",
    signature: model.signature
  })
}

const printProperty = (model: Domain.Property) => {
  return printModel(model.name, model.doc, {
    indentation: 1,
    postfix: "(property)",
    signature: model.signature
  })
}

const printClass = (model: Domain.Class) => {
  return Effect.gen(function*() {
    const header = yield* printModel(model.name, model.doc, {
      postfix: "(class)",
      signature: model.signature
    })
    const staticMethods = yield* Effect.forEach(model.staticMethods, (method) => printStaticMethod(method))
    const methods = yield* Effect.forEach(model.methods, (method) => printMethod(method))
    const properties = yield* Effect.forEach(model.properties, (property) => printProperty(property))
    return header +
      staticMethods.map((s) => "\n\n" + s).join("") +
      methods.map((s) => "\n\n" + s).join("") +
      properties.map((s) => "\n\n" + s).join("")
  })
}

const printConstant = (model: Domain.Constant) => {
  return printModel(model.name, model.doc, {
    signature: model.signature
  })
}

const printExport = (model: Domain.Export) => {
  return printModel(model.name, model.doc, {
    postfix: model.isNamespaceExport ? "(namespace export)" : undefined,
    signature: model.signature
  })
}

const printFunction = (model: Domain.Function) => {
  return printModel(model.name, model.doc, {
    signature: model.signature,
    position: model.position
  })
}

const printInterface = (model: Domain.Interface, indentation: number) => {
  return printModel(model.name, model.doc, {
    indentation,
    postfix: "(interface)",
    signature: model.signature
  })
}

const printTypeAlias = (model: Domain.TypeAlias, indentation: number) => {
  return printModel(model.name, model.doc, {
    indentation,
    postfix: "(type alias)",
    signature: model.signature
  })
}

const printNamespace = (
  model: Domain.Namespace,
  indentation: number
): Effect.Effect<string, never, Configuration.Configuration | Parser.Source> => {
  return Effect.gen(function*() {
    const header = yield* printModel(model.name, model.doc, {
      indentation,
      postfix: "(namespace)"
    })
    const interfaces = yield* Effect.forEach(model.interfaces, (inter) => printInterface(inter, indentation + 1))
    const typeAliases = yield* Effect.forEach(
      model.typeAliases,
      (typeAlias) => printTypeAlias(typeAlias, indentation + 1)
    )
    const namespaces = yield* Effect.forEach(
      model.namespaces,
      (namespace) => printNamespace(namespace, indentation + 1)
    )
    return header +
      interfaces.map((s) => "\n\n" + s).join("") +
      typeAliases.map((s) => "\n\n" + s).join("") +
      namespaces.map((s) => "\n\n" + s).join("")
  })
}

/** @internal */
export const print = (p: Printable) => {
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
 * export const b: string = "b"
 * ```
 *
 * **Example** (Title 2)
 *
 * ~~~js twoslash title="Title 2"
 * export const c: string = "c"
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
  return Effect.gen(function*() {
    const description = yield* printModel(module.name, module.doc, {
      postfix: "overview"
    })

    const printables = pipe(
      sortByName(getPrintables(module)),
      Array.groupBy((printable) =>
        printable.doc.category.length === 0 ? DEFAULT_CATEGORY : printable.doc.category.join(", ")
      ),
      Record.toEntries,
      Array.sort(byCategory)
    )

    const strings = yield* Effect.forEach(printables, ([category, printables]) =>
      Effect.gen(function*() {
        const out = `\n\n# ${category}`
        const strings = yield* Effect.forEach(sortByName(printables), (printable) => print(printable))
        return out + strings.map((s) => "\n\n" + s).join("")
      }))

    const content = strings.join("")

    return `${description}

<!-- toc -->${content}`
  }).pipe(Effect.provideService(Parser.Source, module.source))
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
export const printFrontMatter = (module: Domain.Module, nav_order: number): string => {
  return `---
title: ${module.name}
nav_order: ${nav_order}
parent: Modules
---`
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
