/**
 * @since 1.0.0
 */
import { Context, Data, Effect, Layer } from "effect"
import * as NodeFS from "fs-extra"
import * as Glob from "glob"
import * as Rimraf from "rimraf"

/**
 * Represents a file system which can be read from and written to.
 *
 * @category model
 * @since 1.0.0
 */
export interface FileSystem {
  /**
   * Read a file from the file system at the specified `path`.
   */
  readFile(path: string): Effect.Effect<never, ReadFileError, string>
  /**
   * Read a `.json` file from the file system at the specified `path` and parse
   * the contents.
   */
  readJsonFile(path: string): Effect.Effect<never, ReadFileError | ParseJsonError, unknown>
  /**
   * Write a file to the specified `path` containing the specified `content`.
   */
  writeFile(path: string, content: string): Effect.Effect<never, WriteFileError, void>
  /**
   * Removes a file from the file system at the specified `path`.
   */
  removeFile(path: string): Effect.Effect<never, RemoveFileError, void>
  /**
   * Checks if the specified `path` exists on the file system.
   */
  pathExists(path: string): Effect.Effect<never, ReadFileError, boolean>
  /**
   * Find all files matching the specified `glob` pattern, optionally excluding
   * files matching the provided `exclude` patterns.
   */
  glob(
    pattern: string,
    exclude?: ReadonlyArray<string>
  ): Effect.Effect<never, GlobError, ReadonlyArray<string>>
}

/**
 * Represents an error that occurs when attempting to read a file from the
 * file system.
 *
 * @category model
 * @since 1.0.0
 */
export interface ReadFileError extends Data.Case {
  readonly _tag: "ReadFileError"
  readonly path: string
  readonly error: Error
}

/**
 * @category constructors
 * @since 1.0.0
 */
export const ReadFileError = Data.tagged<ReadFileError>("ReadFileError")

/**
 * Represents an error that occurs when attempting to write a file to the
 * file system.
 *
 * @category model
 * @since 1.0.0
 */
export interface WriteFileError extends Data.Case {
  readonly _tag: "WriteFileError"
  readonly path: string
  readonly error: Error
}

/**
 * @category constructors
 * @since 1.0.0
 */
export const WriteFileError = Data.tagged<WriteFileError>("WriteFileError")

/**
 * Represents an error that occurs when attempting to remove a file from the
 * file system.
 *
 * @category model
 * @since 1.0.0
 */
export interface RemoveFileError extends Data.Case {
  readonly _tag: "RemoveFileError"
  readonly path: string
  readonly error: Error
}

/**
 * @category constructors
 * @since 1.0.0
 */
export const RemoveFileError = Data.tagged<RemoveFileError>("RemoveFileError")

/**
 * Represents an error that occurs when attempting to parse JSON content.
 *
 * @category model
 * @since 1.0.0
 */
export interface ParseJsonError extends Data.Case {
  readonly _tag: "ParseJsonError"
  readonly content: string
  readonly error: Error
}

/**
 * @category constructors
 * @since 1.0.0
 */
export const ParseJsonError = Data.tagged<ParseJsonError>("ParseJsonError")

/**
 * Represents an error that occurs when attempting to execute a glob pattern to
 * find multiple files on the file system.
 *
 * @category model
 * @since 1.0.0
 */
export interface GlobError extends Data.Case {
  readonly _tag: "GlobError"
  readonly pattern: string
  readonly exclude: ReadonlyArray<string>
  readonly error: Error
}

/**
 * @category constructors
 * @since 1.0.0
 */
export const GlobError = Data.tagged<GlobError>("GlobError")

/**
 * @category service
 * @since 1.0.0
 */
export const FileSystem = Context.Tag<FileSystem>()

/**
 * @category service
 * @since 1.0.0
 */
export const FileSystemLive = Layer.effect(
  FileSystem,
  Effect.sync(() => {
    const readFile = (path: string): Effect.Effect<never, ReadFileError, string> =>
      Effect.async((resume) =>
        NodeFS.readFile(path, "utf8", (error, data) => {
          if (error) {
            resume(Effect.fail(ReadFileError({ path, error })))
          } else {
            resume(Effect.succeed(data))
          }
        })
      )
    const readJsonFile = (
      path: string
    ): Effect.Effect<never, ReadFileError | ParseJsonError, unknown> =>
      Effect.flatMap(readFile(path), (content) =>
        Effect.try({
          try: () => JSON.parse(content),
          catch: (error) =>
            ParseJsonError({
              content,
              error: error instanceof Error ? error : new Error(String(error))
            })
        }))
    const writeFile = (path: string, content: string): Effect.Effect<never, WriteFileError, void> =>
      Effect.async((resume) =>
        NodeFS.outputFile(path, content, "utf8", (error) => {
          if (error) {
            resume(Effect.fail(WriteFileError({ path, error })))
          } else {
            resume(Effect.unit)
          }
        })
      )
    const removeFile = (path: string): Effect.Effect<never, RemoveFileError, void> =>
      Effect.tryPromise({
        try: () => Rimraf.rimraf(path),
        catch: (error) =>
          RemoveFileError({
            error: error instanceof Error ? error : new Error(String(error)),
            path
          })
      })

    const pathExists = (path: string): Effect.Effect<never, ReadFileError, boolean> =>
      Effect.async((resume) =>
        NodeFS.pathExists(path, (error, data) => {
          if (error) {
            resume(Effect.fail(ReadFileError({ error, path })))
          } else {
            resume(Effect.succeed(data))
          }
        })
      )
    const glob = (
      pattern: string,
      exclude: Array<string> = []
    ): Effect.Effect<never, GlobError, Array<string>> =>
      Effect.tryPromise({
        try: () => Glob.glob(pattern, { ignore: exclude, withFileTypes: false }),
        catch: (error) =>
          GlobError({
            error: error instanceof Error ? error : new Error(String(error)),
            exclude,
            pattern
          })
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
)

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
    readonly overwrite: boolean
  }>
{}

/**
 * By default files are readonly (`overwrite = false`).
 *
 * @category constructors
 * @since 1.0.0
 */
export const makeFile = (
  path: string,
  content: string,
  overwrite = false
): File =>
  Data.struct({
    path,
    content,
    overwrite
  })
