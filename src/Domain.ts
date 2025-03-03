/**
 * @since 0.6.0
 */

import * as Data from "effect/Data"
import type * as Option from "effect/Option"
import * as Order from "effect/Order"
import * as String from "effect/String"

/**
 * @category model
 * @since 0.6.0
 */
export class Example {
  constructor(readonly body: string) {}
}

/**
 * @category model
 * @since 0.6.0
 */
export class Doc {
  constructor(
    readonly description: Option.Option<string>,
    readonly since: Option.Option<string>,
    readonly deprecated: boolean,
    readonly examples: ReadonlyArray<Example>,
    readonly category: Option.Option<string>
  ) {}
}

/**
 * @category model
 * @since 0.6.0
 */
export class NamedDoc extends Doc {
  constructor(
    readonly name: string,
    description: Option.Option<string>,
    since: Option.Option<string>,
    deprecated: boolean,
    examples: ReadonlyArray<Example>,
    category: Option.Option<string>
  ) {
    super(description, since, deprecated, examples, category)
  }
}

/**
 * @category model
 * @since 0.6.0
 */
export class Module extends NamedDoc {
  constructor(
    doc: NamedDoc,
    readonly path: ReadonlyArray<string>,
    readonly classes: ReadonlyArray<Class>,
    readonly interfaces: ReadonlyArray<Interface>,
    readonly functions: ReadonlyArray<Function>,
    readonly typeAliases: ReadonlyArray<TypeAlias>,
    readonly constants: ReadonlyArray<Constant>,
    readonly exports: ReadonlyArray<Export>,
    readonly namespaces: ReadonlyArray<Namespace>
  ) {
    super(doc.name, doc.description, doc.since, doc.deprecated, doc.examples, doc.category)
  }
}

/**
 * @category model
 * @since 0.6.0
 */
export class Class extends NamedDoc {
  /**
   * @since 0.6.0
   */
  readonly _tag = "Class"
  constructor(
    doc: NamedDoc,
    readonly signature: string,
    readonly methods: ReadonlyArray<Method>,
    readonly staticMethods: ReadonlyArray<Method>,
    readonly properties: ReadonlyArray<Property>
  ) {
    super(doc.name, doc.description, doc.since, doc.deprecated, doc.examples, doc.category)
  }
}

/**
 * @category model
 * @since 0.6.0
 */
export class Method extends NamedDoc {
  constructor(
    doc: NamedDoc,
    readonly signatures: ReadonlyArray<string>
  ) {
    super(doc.name, doc.description, doc.since, doc.deprecated, doc.examples, doc.category)
  }
}

/**
 * @category model
 * @since 0.6.0
 */
export class Property extends NamedDoc {
  constructor(
    doc: NamedDoc,
    readonly signature: string
  ) {
    super(doc.name, doc.description, doc.since, doc.deprecated, doc.examples, doc.category)
  }
}

/**
 * @category model
 * @since 0.6.0
 */
export class Interface extends NamedDoc {
  /**
   * @since 0.6.0
   */
  readonly _tag = "Interface"
  constructor(
    doc: NamedDoc,
    readonly signature: string
  ) {
    super(doc.name, doc.description, doc.since, doc.deprecated, doc.examples, doc.category)
  }
}

/**
 * @category model
 * @since 0.6.0
 */
export class Function extends NamedDoc {
  /**
   * @since 0.6.0
   */
  readonly _tag = "Function"
  constructor(
    doc: NamedDoc,
    readonly signatures: ReadonlyArray<string>,
    readonly throws: ReadonlyArray<string>
  ) {
    super(doc.name, doc.description, doc.since, doc.deprecated, doc.examples, doc.category)
  }
}

/**
 * @category model
 * @since 0.6.0
 */
export class TypeAlias extends NamedDoc {
  /**
   * @since 0.6.0
   */
  readonly _tag = "TypeAlias"
  constructor(
    doc: NamedDoc,
    readonly signature: string
  ) {
    super(doc.name, doc.description, doc.since, doc.deprecated, doc.examples, doc.category)
  }
}

/**
 * @category model
 * @since 0.6.0
 */
export class Constant extends NamedDoc {
  /**
   * @since 0.6.0
   */
  readonly _tag = "Constant"
  constructor(
    doc: NamedDoc,
    readonly signature: string
  ) {
    super(doc.name, doc.description, doc.since, doc.deprecated, doc.examples, doc.category)
  }
}

/**
 * These are manual exports, like:
 *
 * ```ts skip-type-checking
 * const _null = ...
 *
 * export {
 *   _null as null
 * }
 * ```
 *
 * @category model
 * @since 0.6.0
 */
export class Export extends NamedDoc {
  /**
   * @since 0.6.0
   */
  readonly _tag = "Export"
  constructor(
    doc: NamedDoc,
    readonly signature: string
  ) {
    super(doc.name, doc.description, doc.since, doc.deprecated, doc.examples, doc.category)
  }
}

/**
 * @category model
 * @since 0.6.0
 */
export class Namespace extends NamedDoc {
  /**
   * @since 0.6.0
   */
  readonly _tag = "Namespace"
  constructor(
    doc: NamedDoc,
    readonly interfaces: ReadonlyArray<Interface>,
    readonly typeAliases: ReadonlyArray<TypeAlias>,
    readonly namespaces: ReadonlyArray<Namespace>
  ) {
    super(doc.name, doc.description, doc.since, doc.deprecated, doc.examples, doc.category)
  }
}

/**
 * A comparator function for sorting `Module` objects by their file path, represented as a string.
 * The file path is converted to lowercase before comparison.
 *
 * @category sorting
 * @since 0.6.0
 */
export const ByPath: Order.Order<Module> = Order.mapInput(
  String.Order,
  (module: Module) => module.path.join("/").toLowerCase()
)

/**
 * Represents a file which can be optionally overwriteable.
 *
 * @category model
 * @since 0.6.0
 */
export class File {
  constructor(
    readonly path: string,
    readonly content: string,
    readonly isOverwriteable: boolean = false
  ) {}
}

/**
 * @category symbol
 * @since 0.6.0
 */
export const DocgenErrorTypeId = Symbol.for("@effect/docgen/DocgenError")

/**
 * @category symbol
 * @since 0.6.0
 */
export type DocgenErrorTypeId = typeof DocgenErrorTypeId

/**
 * @category model
 * @since 0.6.0
 */
export class DocgenError extends Data.TaggedError("DocgenError")<{
  readonly message: string
}> {
}
