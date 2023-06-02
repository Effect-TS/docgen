/**
 * @since 1.0.0
 */
import * as Context from "@effect/data/Context"
import * as Effect from "@effect/io/Effect"
import * as Layer from "@effect/io/Layer"

/**
 * Represents a handle to the currently executing process.
 *
 * @category model
 * @since 1.0.0
 */
export interface Process {
  readonly cwd: Effect.Effect<never, never, string>
  readonly platform: Effect.Effect<never, never, string>
}

/**
 * @category service
 * @since 1.0.0
 */
export const Process = Context.Tag<Process>()

/**
 * @category service
 * @since 1.0.0
 */
export const ProcessLive = Layer.succeed(
  Process,
  Process.of({
    cwd: Effect.sync(() => process.cwd()),
    platform: Effect.sync(() => process.platform)
  })
)
