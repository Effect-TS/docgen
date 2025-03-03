/**
 * @since 0.6.0
 */

import * as Data from "effect/Data"

/**
 * Represents a file which can be optionally overwriteable.
 *
 * @category model
 * @since 0.6.0
 */
export interface File {
  readonly path: string
  readonly content: string
  readonly isOverwriteable: boolean
}

/**
 * By default files are readonly (`isOverwriteable = false`).
 *
 * @category constructors
 * @since 0.6.0
 */
export const createFile = (path: string, content: string, isOverwriteable = false): File =>
  Data.struct({ path, content, isOverwriteable })
