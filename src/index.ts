/**
 * @since 1.0.0
 */
import { Effect } from "effect"
import * as Core from "./Core"

/**
 * @category main
 * @since 1.0.0
 */
export const main = Effect.tapErrorCause(Core.main, Effect.logError)
