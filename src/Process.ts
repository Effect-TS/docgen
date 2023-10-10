/**
 * @since 1.0.0
 */

import { Context, Effect, Layer } from "effect"

/**
 * Represents a handle to the currently executing process.
 *
 * @category service
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
 * @category layer
 * @since 1.0.0
 */
export const ProcessLive = Layer.succeed(
  Process,
  Process.of({
    cwd: Effect.sync(() => process.cwd()),
    platform: Effect.sync(() => process.platform)
  })
)
