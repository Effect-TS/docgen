/**
 * @since 1.0.0
 */
import * as Context from "@effect/data/Context"
import * as Data from "@effect/data/Data"
import { pipe } from "@effect/data/Function"
import * as Effect from "@effect/io/Effect"
import * as Layer from "@effect/io/Layer"
import * as NodeChildProcess from "node:child_process"

/**
 * Represents an entity that is capable of spawning child processes.
 *
 * @category model
 * @since 1.0.0
 */
export interface ChildProcess {
  /**
   * Executes a command like:
   *
   * ```sh
   * ts-node docs/examples/index.ts
   * ```
   *
   * where `command = ts-node` and `executable = docs/examples/index.ts`
   */
  spawn(
    command: string,
    executable: string
  ): Effect.Effect<never, ExecutionError | SpawnError, void>
}

/**
 * Represents an error that occurs when trying to spawn a child process.
 *
 * @category model
 * @since 1.0.0
 */
export interface SpawnError extends Data.Case {
  readonly _tag: "SpawnError"
  readonly command: string
  readonly args: ReadonlyArray<string>
  readonly error: Error
}

/**
 * @category constructors
 * @since 1.0.0
 */
export const SpawnError = Data.tagged<SpawnError>("SpawnError")

/**
 * Represents an error that occurs within a child process during execution.
 *
 * @category model
 * @since 1.0.0
 */
export interface ExecutionError extends Data.Case {
  readonly _tag: "ExecutionError"
  readonly command: string
  readonly stderr: string
}

/**
 * @category constructors
 * @since 1.0.0
 */
export const ExecutionError = Data.tagged<ExecutionError>("ExecutionError")

/**
 * @category service
 * @since 1.0.0
 */
export const ChildProcess = Context.Tag<ChildProcess>()

/**
 * @category service
 * @since 1.0.0
 */
export const ChildProcessLive = Layer.succeed(
  ChildProcess,
  ChildProcess.of({
    spawn: (command, executable) =>
      pipe(
        Effect.tryCatch(() =>
          NodeChildProcess.spawnSync(command, [executable], {
            stdio: "pipe",
            encoding: "utf8"
          }), (error) =>
          SpawnError({
            command,
            args: [executable],
            error: error instanceof Error ? error : new Error(String(error))
          })),
        Effect.flatMap(({ status, stderr }) =>
          status === 0
            ? Effect.unit()
            : Effect.fail(ExecutionError({ command, stderr }))
        )
      )
  })
)
