/**
 * @since 1.0.0
 */
import * as PlatformFileSystem from "@effect/platform-node/FileSystem"
import { Context, Data, Effect, Layer } from "effect"
import * as FSExtra from "fs-extra"
import * as Glob from "glob"

/**
 * Represents a file system which can be read from and written to.
 *
 * @category service
 * @since 1.0.0
 */
export interface FileSystem {
  /**
   * Read a file from the file system at the specified `path`.
   */
  readonly readFile: (path: string) => Effect.Effect<never, Error, string>
  /**
   * Read a `.json` file from the file system at the specified `path` and parse
   * the contents.
   */
  readonly readJsonFile: (path: string) => Effect.Effect<never, Error, unknown>
  /**
   * Write a file to the specified `path` containing the specified `content`.
   */
  readonly writeFile: (path: string, content: string) => Effect.Effect<never, Error, void>
  /**
   * Removes a file from the file system at the specified `path`.
   */
  readonly removeFile: (path: string) => Effect.Effect<never, Error, void>
  /**
   * Checks if the specified `path` exists on the file system.
   */
  readonly pathExists: (path: string) => Effect.Effect<never, Error, boolean>
  /**
   * Find all files matching the specified `glob` pattern, optionally excluding
   * files matching the provided `exclude` patterns.
   */
  readonly glob: (
    pattern: string,
    exclude?: ReadonlyArray<string>
  ) => Effect.Effect<never, Error, Array<string>>
}

/**
 * A context tag for the file system module.
 *
 * @category service
 * @since 1.0.0
 */
export const FileSystem = Context.Tag<FileSystem>()

/**
 * A layer that provides a live implementation of the FileSystem interface using the PlatformFileSystem implementation.
 *
 * @category layer
 * @since 1.0.0
 */
export const FileSystemLive = Layer.effect(
  FileSystem,
  Effect.map(PlatformFileSystem.FileSystem, (fs) => {
    const readFile = (path: string): Effect.Effect<never, Error, string> =>
      fs.readFileString(path, "utf8").pipe(
        Effect.mapError((error) =>
          new Error(`[FileSystem] Unable to read file from '${path}': ${error.message}`)
        )
      )

    const readJsonFile = (
      path: string
    ): Effect.Effect<never, Error, unknown> =>
      Effect.flatMap(readFile(path), (content) =>
        Effect.try({
          try: () => JSON.parse(content),
          catch: (error) =>
            new Error(
              `[FileSystem] Unable to read and parse JSON file from '${path}': ${String(error)}`
            )
        }))

    const writeFile = (path: string, content: string): Effect.Effect<never, Error, void> =>
      Effect.async((resume) =>
        FSExtra.outputFile(path, content, "utf8", (error) => {
          if (error) {
            resume(
              Effect.fail(
                new Error(`[FileSystem] Unable to write file to '${path}': ${error.message}`)
              )
            )
          } else {
            resume(Effect.unit)
          }
        })
      )

    const removeFile = (
      path: string
    ): Effect.Effect<never, Error, void> =>
      Effect.if(
        pathExists(path),
        {
          onTrue: fs.remove(path, { recursive: true }).pipe(
            Effect.mapError((error) =>
              new Error(`[FileSystem] Unable to remove file from '${path}': ${error.message}`)
            )
          ),
          onFalse: Effect.unit
        }
      )

    const pathExists = (path: string): Effect.Effect<never, Error, boolean> =>
      fs.exists(path).pipe(
        Effect.mapError((error) =>
          new Error(`[FileSystem] Unable to read file from '${path}': ${error.message}`)
        )
      )

    const glob = (
      pattern: string,
      exclude: ReadonlyArray<string> = []
    ): Effect.Effect<never, Error, Array<string>> =>
      Effect.tryPromise({
        try: () => Glob.glob(pattern, { ignore: exclude.slice(), withFileTypes: false }),
        catch: (error) =>
          new Error(
            `[FileSystem] Unable to execute glob pattern '${pattern}' excluding files matching '${exclude}': ${
              String(error)
            }`
          )
      })

    return FileSystem.of({
      readFile,
      readJsonFile,
      writeFile,
      removeFile,
      pathExists,
      glob
    })
  })
).pipe(Layer.use(PlatformFileSystem.layer))

/**
 * Represents a file which can be optionally overwriteable.
 *
 * @category model
 * @since 1.0.0
 */
export interface File extends
  Data.Data<{
    readonly path: string
    readonly content: string
    readonly isOverwriteable: boolean
  }>
{}

/**
 * By default files are readonly (`isOverwriteable = false`).
 *
 * @category constructors
 * @since 1.0.0
 */
export const createFile = (path: string, content: string, isOverwriteable = false): File =>
  Data.struct({ path, content, isOverwriteable })
