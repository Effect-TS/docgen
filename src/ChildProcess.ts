/**
 * @since 1.0.0
 */
import { Context, Effect, Layer } from "effect"
import * as NodeChildProcess from "node:child_process"

/**
 * Represents an entity that is capable of spawning child processes.
 *
 * @category service
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
  ): Effect.Effect<never, Error, void>
}

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
      Effect.try({
        try: () =>
          NodeChildProcess.spawnSync(command, [executable], {
            stdio: "pipe",
            encoding: "utf8"
          }),
        catch: (error) =>
          new Error(
            `[CommandExecutor] Unable to spawn child process for command: '${command} ${executable}':\n${
              String(error)
            }`
          )
      }).pipe(
        Effect.flatMap(({ status, stderr }) =>
          status === 0
            ? Effect.unit
            : Effect.fail(
              new Error(
                `[CommandExecutor] During execution of '${command}', the following error occurred:\n${stderr}`
              )
            )
        )
      )
  })
)
