/**
 * @since 0.6.0
 */
import * as Array from "effect/Array"
import * as Effect from "effect/Effect"
import { identity, pipe } from "effect/Function"
import * as Option from "effect/Option"
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

const printTitle = (s: string, deprecated: boolean, type?: string): string => {
  const name = s.trim() === "hasOwnProperty" ? `${s} (function)` : s
  const title = deprecated ? Markdown.strikethrough(name) : name
  return Option.fromNullable(type).pipe(
    Option.match({
      onNone: () => title,
      onSome: (t) => title + ` ${t}`
    })
  )
}

const printOptionalString = (s: string | undefined): string => {
  if (s === undefined) {
    return ""
  }
  return `\n\n${s}`
}

const printArray = (title: string, ss?: ReadonlyArray<string>): string => {
  if (ss === undefined || ss.length === 0) {
    return ""
  }
  return `\n\n${Markdown.bold(title)}\n\n${ss.join("\n")}`
}

const printFence = (s: string): string => {
  if (s.startsWith("```ts") || s.startsWith("~~~ts")) {
    return s
  }
  return "```ts\n" + s + "\n```"
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

const printOptionalSince = (since: string | undefined): string => {
  if (since === undefined) {
    return ""
  }
  return `\n\nSince v${since}`
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

const printModel = (name: string, doc: Domain.Doc, options: {
  readonly indentation?: number
  readonly postfix?: string
  readonly signatures?: ReadonlyArray<string>
  readonly throws?: ReadonlyArray<string>
}): string => {
  return printHeaderByIndentation(options.indentation ?? 0) + printTitle(name, doc.deprecated, options.postfix) +
    printOptionalString(doc.description) +
    printThrowsArray(options.throws) +
    printExamplesArray(doc.examples.map(({ body }) => body)) +
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

const printModuleDescription = (module: Domain.Module): string => {
  return printModel(module.name, module.doc, {
    postfix: "overview"
  })
}

const printMeta = (title: string, order: number): string => {
  return [
    "---",
    `\n`,
    `title: ${title}`,
    `\n`,
    `nav_order: ${order}`,
    `\n`,
    `parent: Modules`,
    `\n`,
    "---"
  ].join("")
}

/** @internal */
export const printClass = (model: Domain.Class): string => {
  const header = printModel(model.name, model.doc, {
    postfix: "(class)",
    signatures: [model.signature]
  })
  return header + "\n\n" +
    model.staticMethods.map((method) => printStaticMethod(method) + "\n\n").join("") +
    model.methods.map((method) => printMethod(method) + "\n\n").join("") +
    model.properties.map((property) => printProperty(property) + "\n\n").join("")
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
    signatures: [model.signature]
  })
}

/** @internal */
export const printFunction = (model: Domain.Function): string => {
  return printModel(model.name, model.doc, {
    signatures: model.signatures,
    throws: model.throws
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
    case "Module": {
      const { content, description } = getModuleComponents(p)
      return description + content
    }
  }
}

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

const DEFAULT_CATEGORY = "utils"

const byCategory = Order.mapInput(
  String.Order,
  ([category]: [string, ...Array<unknown>]) => category
)

const getModuleComponents = (module: Domain.Module) => {
  const description = printModuleDescription(module) + "\n"

  const content = pipe(
    getPrintables(module),
    Array.groupBy((printable) => printable.doc.category ?? DEFAULT_CATEGORY),
    Record.toEntries,
    Array.sort(byCategory),
    Array.map(([category, printables]) =>
      [
        `# ${category}`,
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

  return { description, content }
}

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
 * const doc = new Domain.Doc(undefined, "1.0.0", false, [], undefined)
 * const m = new Domain.Module("tests", doc, ["src", "tests.ts"], [], [], [], [], [], [], [])
 * console.log(Printer.printModule(m, 0))
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
 * @category printers
 * @since 0.6.0
 */
export const printModule = (module: Domain.Module, order: number): Effect.Effect<string> =>
  Effect.gen(function*() {
    const header = printMeta(module.path.slice(1).join("/"), order)

    const { content, description } = getModuleComponents(module)

    const toc = yield* Effect.tryPromise({
      try: () => {
        // @ts-ignore
        return import("@effect/markdown-toc").then((m) => m.default)
      },
      catch: identity
    }).pipe(Effect.orDie)

    const tableOfContents = (content: string) =>
      "<h2 class=\"text-delta\">Table of contents</h2>\n\n"
      + toc(content).content
      + "\n\n"

    return yield* prettify(
      [
        header,
        description,
        "---\n",
        tableOfContents(content),
        "---\n",
        content
      ].join("\n")
    )
  })

const defaultPrettierOptions: Prettier.Options = {
  parser: "markdown",
  semi: false,
  singleQuote: false,
  printWidth: 120,
  trailingComma: "none"
}

/** @internal */
export const prettify = (s: string): Effect.Effect<string> =>
  Effect.tryPromise({
    try: () => Prettier.format(s, defaultPrettierOptions),
    catch: identity
  }).pipe(Effect.orDie)
