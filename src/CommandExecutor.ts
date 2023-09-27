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
export interface CommandExecutor {
  readonly spawn: (command: string, ...args: Array<string>) => Effect.Effect<never, Error, void>
}

/**
 * @category service
 * @since 1.0.0
 */
export const CommandExecutor = Context.Tag<CommandExecutor>()

/**
 * @category layer
 * @since 1.0.0
 */
export const CommandExecutorLive = Layer.succeed(
  CommandExecutor,
  CommandExecutor.of({
    spawn: (command, ...args) =>
      Effect.try({
        try: () => NodeChildProcess.spawnSync(command, args, { stdio: "pipe", encoding: "utf8" }),
        catch: (error) =>
          new Error(
            `[CommandExecutor] Unable to spawn command: '${command} ${String(args)}':\n${
              String(error)
            }`
          )
      }).pipe(
        Effect.flatMap(({ status, stderr }) =>
          status === 0
            ? Effect.unit
            : Effect.fail(
              new Error(
                `[CommandExecutor] During execution of '${command}', the following error(s) occurred:\n${stderr}`
              )
            )
        )
      )
  })
)
