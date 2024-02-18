/**
 * @since 1.0.0
 */

import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import * as Schema from "@effect/schema/Schema"
import * as TreeFormatter from "@effect/schema/TreeFormatter"
import * as Config from "effect/Config"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import { identity } from "effect/Function"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as ReadonlyArray from "effect/ReadonlyArray"
import * as tsconfck from "tsconfck"
import { DocgenError } from "./Error.js"
import * as Process from "./Process.js"

const PACKAGE_JSON_FILE_NAME = "package.json"
const CONFIG_FILE_NAME = "docgen.json"

const compilerOptionsSchema = Schema.union(
  Schema.string,
  Schema.record(Schema.string, Schema.unknown)
)

/**
 * @category service
 * @since 1.0.0
 */
export const ConfigurationSchema = Schema.struct({
  "$schema": Schema.optional(Schema.string, { exact: true }),
  projectHomepage: Schema.optional(
    Schema.string.pipe(
      Schema.description(
        "Will link to the project homepage from the Auxiliary Links of the " +
          "generated documentation."
      )
    ),
    { exact: true }
  ),
  srcDir: Schema.optional(
    Schema.string.pipe(
      Schema.description(
        "The directory in which docgen will search for TypeScript files to parse."
      ),
      Schema.default("src")
    ),
    { exact: true }
  ),
  outDir: Schema.optional(
    Schema.string.pipe(
      Schema.description(
        "The directory to which docgen will generate its output markdown documents."
      ),
      Schema.default("docs")
    ),
    { exact: true }
  ),
  theme: Schema.optional(
    Schema.string.pipe(
      Schema.description(
        "The theme that docgen will specify should be used for GitHub Docs " +
          "in the generated _config.yml file."
      ),
      Schema.default("mikearnaldi/just-the-docs")
    ),
    { exact: true }
  ),
  enableSearch: Schema.optional(
    Schema.boolean.pipe(
      Schema.description(
        "Whether or not search should be enabled for GitHub Docs " +
          "in the generated _config.yml file."
      ),
      Schema.default(true)
    ),
    { exact: true }
  ),
  enforceDescriptions: Schema.optional(
    Schema.boolean.pipe(
      Schema.description(
        "Whether or not descriptions for each module export " +
          "should be required."
      ),
      Schema.default(false)
    ),
    { exact: true }
  ),
  enforceExamples: Schema.optional(
    Schema.boolean.pipe(
      Schema.description(
        "Whether or not @example tags for each module export should be required. " +
          "(Note: examples will not be enforced in module documentation)"
      ),
      Schema.default(false)
    ),
    { exact: true }
  ),
  enforceVersion: Schema.optional(
    Schema.boolean.pipe(
      Schema.description("Whether or not @since tags for each module export should be required."),
      Schema.default(true)
    ),
    { exact: true }
  ),
  exclude: Schema.optional(
    Schema.array(Schema.string).pipe(
      Schema.description(
        "An array of glob strings specifying files that should be excluded from the documentation."
      ),
      Schema.default<ReadonlyArray<string>>([])
    ),
    { exact: true }
  ),
  parseCompilerOptions: Schema.optional(
    compilerOptionsSchema.pipe(
      Schema.description("tsconfig for parsing options (or path to a tsconfig)"),
      Schema.default({})
    ),
    { exact: true }
  ),
  examplesCompilerOptions: Schema.optional(
    compilerOptionsSchema.pipe(
      Schema.description("tsconfig for the examples options (or path to a tsconfig)"),
      Schema.default({})
    ),
    { exact: true }
  )
})

/**
 * @category service
 * @since 1.0.0
 */
export interface Configuration {
  readonly projectName: string
  readonly projectHomepage: string
  readonly srcDir: string
  readonly outDir: string
  readonly theme: string
  readonly enableSearch: boolean
  readonly enforceDescriptions: boolean
  readonly enforceExamples: boolean
  readonly enforceVersion: boolean
  readonly runExamples: boolean
  readonly exclude: ReadonlyArray<string>
  readonly parseCompilerOptions: Record<string, unknown>
  readonly examplesCompilerOptions: Record<string, unknown>
}

/**
 * @category service
 * @since 1.0.0
 */
export const Configuration = Context.GenericTag<Configuration>("@services/Configuration")

/** @internal */
export const defaultCompilerOptions = {
  noEmit: true,
  strict: true,
  skipLibCheck: true,
  moduleResolution: "Bundler",
  target: "ES2022",
  lib: [
    "ES2022",
    "DOM"
  ]
}

const readJsonFile = (
  path: string
): Effect.Effect<unknown, never, FileSystem.FileSystem> =>
  Effect.gen(function*(_) {
    const fs = yield* _(FileSystem.FileSystem)
    const content = yield* _(Effect.orDie(fs.readFileString(path)))
    return yield* _(
      Effect.try({
        try: () => JSON.parse(content),
        catch: (error) =>
          `[FileSystem] Unable to read and parse JSON file from '${path}': ${String(error)}`
      }),
      Effect.orDie
    )
  })

const validateJsonFile = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  path: string
): Effect.Effect<A, never, R | FileSystem.FileSystem> =>
  Effect.gen(function*(_) {
    const content = yield* _(readJsonFile(path))
    const decode = Schema.decodeUnknown(schema)
    return yield* _(
      decode(content),
      Effect.orDieWith((error) =>
        new DocgenError({
          message: `[Configuration.validateJsonFile]\n${TreeFormatter.formatError(error)}`
        })
      )
    )
  })

const readDocgenConfig = (
  path: string
): Effect.Effect<
  Option.Option<Schema.Schema.To<typeof ConfigurationSchema>>,
  never,
  FileSystem.FileSystem
> =>
  Effect.gen(function*(_) {
    const fs = yield* _(FileSystem.FileSystem)
    const exists = yield* _(Effect.orDie(fs.exists(path)))
    if (exists) {
      const config = yield* _(validateJsonFile(ConfigurationSchema, path))
      return Option.some(config)
    } else {
      return Option.none()
    }
  })

const readTSConfig = (
  fileName: string
): Effect.Effect<{ readonly [x: string]: unknown }, never, Path.Path | Process.Process> =>
  Effect.gen(function*(_) {
    const path = yield* _(Path.Path)
    const process = yield* _(Process.Process)
    const cwd = yield* _(process.cwd)
    return yield* _(
      Effect.promise(() => tsconfck.parse(path.resolve(cwd, fileName))).pipe(
        Effect.map(({ tsconfig }) => tsconfig.compilerOptions ?? defaultCompilerOptions),
        Effect.orDieWith((error) =>
          new DocgenError({
            message: `[Configuration.readTSConfig] Failed to read TSConfig file\n${String(error)}`
          })
        )
      )
    )
  })

const loadCompilerOptions = (configKey: string) =>
  Config.string(configKey).pipe(
    Effect.flatMap((config) =>
      Schema.decodeUnknown(JsonRecordSchema)(config).pipe(Effect.orElseSucceed(() => config))
    )
  )

const resolveCompilerOptions = (
  configKey: string,
  fromCLI: Option.Option<string | Record<string, unknown>>,
  fromDocgenJson: Option.Option<string | Record<string, unknown>>
): Effect.Effect<{ readonly [x: string]: unknown }, never, Path.Path | Process.Process> => {
  const fromConfigProvider = loadCompilerOptions(configKey)
  return fromCLI.pipe(
    Effect.orElse(() => fromConfigProvider),
    Effect.orElse(() => fromDocgenJson),
    Effect.matchEffect({
      onFailure: () => Effect.succeed(defaultCompilerOptions),
      onSuccess: (config) =>
        typeof config === "string"
          ? readTSConfig(config) :
          Effect.succeed(config)
    })
  )
}

const JsonRecordSchema = Schema.parseJson(Schema.record(Schema.string, Schema.unknown))

const PackageJsonSchema = Schema.struct({
  name: Schema.string,
  homepage: Schema.string
})

/** @internal */
export const load = (args: {
  readonly projectHomepage: Option.Option<string>
  readonly srcDir: string
  readonly outDir: string
  readonly theme: string
  readonly enableSearch: boolean
  readonly enforceDescriptions: boolean
  readonly enforceExamples: boolean
  readonly enforceVersion: boolean
  readonly runExamples: boolean
  readonly exclude: ReadonlyArray<string>
  readonly parseCompilerOptions: Option.Option<string | Record<string, unknown>>
  readonly examplesCompilerOptions: Option.Option<string | Record<string, unknown>>
}) =>
  Effect.gen(function*(_) {
    // Extract the requisite services
    const process = yield* _(Process.Process)
    const cwd = yield* _(process.cwd)
    const path = yield* _(Path.Path)

    // Read and parse the required fields from the `package.json`
    const packageJsonPath = path.join(cwd, PACKAGE_JSON_FILE_NAME)
    const packageJson = yield* _(validateJsonFile(PackageJsonSchema, packageJsonPath))
    const projectName = packageJson.name
    const projectHomepage = Option.getOrElse(args.projectHomepage, () => packageJson.homepage)

    // Read the `docgen.json` configuration file to gain access to the TypeScript
    // configuration options
    const configPath = path.join(cwd, CONFIG_FILE_NAME)
    const config = yield* _(readDocgenConfig(configPath))

    // Resolve the excluded files
    const exclude = ReadonlyArray.match(args.exclude, {
      onEmpty: () =>
        Option.match(config, {
          onNone: () => ReadonlyArray.empty<string>(),
          onSome: ({ exclude }) => exclude || ReadonlyArray.empty<string>()
        }),
      onNonEmpty: identity
    })

    // Resolve the TypeScript configuration options
    const examplesCompilerOptions = yield* _(
      resolveCompilerOptions(
        "examplesCompilerOptions",
        args.examplesCompilerOptions,
        Option.flatMap(config, (config) => Option.fromNullable(config.examplesCompilerOptions))
      )
    )
    const parseCompilerOptions = yield* _(
      resolveCompilerOptions(
        "parseCompilerOptions",
        args.parseCompilerOptions,
        Option.flatMap(config, (config) => Option.fromNullable(config.parseCompilerOptions))
      )
    )

    return Configuration.of({
      ...args,
      projectName,
      projectHomepage,
      exclude,
      examplesCompilerOptions,
      parseCompilerOptions
    })
  })

/** @internal */
export const configProviderLayer = Layer.scopedDiscard(Effect.gen(function*(_) {
  // Extract the requisite services
  const process = yield* _(Process.Process)
  const cwd = yield* _(process.cwd)
  const path = yield* _(Path.Path)
  // Attempt to load the `docgen.json` configuration file
  const configPath = path.join(cwd, CONFIG_FILE_NAME)
  const maybeConfig = yield* _(readDocgenConfig(configPath))
  // Construct a config provider for the environment
  const fromEnv = ConfigProvider.fromEnv({ pathDelim: "_", seqDelim: "," }).pipe(
    ConfigProvider.nested("DOCGEN"),
    ConfigProvider.constantCase
  )
  // Construct a config provider for the `docgen.json` file
  const fromDocgenJson = ConfigProvider.fromJson(Option.getOrElse(maybeConfig, () => ({})))
  // Prefer the environment over the `docgen.json` file
  const provider = fromEnv.pipe(ConfigProvider.orElse(() => fromDocgenJson))
  yield* _(Effect.withConfigProviderScoped(provider))
}))
