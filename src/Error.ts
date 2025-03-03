/**
 * @since 0.6.0
 */

import * as Data from "effect/Data"

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
