/**
 * @since 1.0.0
 */
import { pipe } from "@effect/data/Function"
import * as Effect from "@effect/io/Effect"
import * as Core from "./Core"

/**
 * @category main
 * @since 1.0.0
 */
export const main = pipe(
  Core.main,
  Effect.tapErrorCause(Effect.logError)
)
