/**
 * @since 1.0.0
 */
import { Path } from "@effect/platform-node"
import * as Schema from "@effect/schema/Schema"
import * as TreeFormatter from "@effect/schema/TreeFormatter"
import chalk from "chalk"
import { Context, Effect, Layer, Option } from "effect"
import * as tsconfck from "tsconfck"
import * as FileSystem from "./FileSystem.js"
import * as Process from "./Process.js"

const PACKAGE_JSON_FILE_NAME = "package.json"
const CONFIG_FILE_NAME = "docgen.json"

/**
 * @category service
 * @since 1.0.0
 */
export const ConfigSchema = Schema.struct({
  "$schema": Schema.optional(Schema.string),
  projectHomepage: Schema.optional(Schema.string, {
    description:
      "Will link to the project homepage from the Auxiliary Links of the generated documentation."
  }),
  srcDir: Schema.optional(Schema.string, {
    description: "The directory in which docgen will search for TypeScript files to parse.",
    default: "src"
  }),
  outDir: Schema.optional(Schema.string, {
    description: "The directory to which docgen will generate its output markdown documents.",
    default: "docs"
  }),
  theme: Schema.optional(Schema.string, {
    description:
      "The theme that docgen will specify should be used for GitHub Docs in the generated _config.yml file.",
    default: "mikearnaldi/just-the-docs"
  }),
  enableSearch: Schema.optional(Schema.boolean, {
    description:
      "Whether or search should be enabled for GitHub Docs in the generated _config.yml file.",
    default: true
  }),
  enforceDescriptions: Schema.optional(Schema.boolean, {
    description: "Whether or not descriptions for each module export should be required.",
    default: false
  }),
  enforceExamples: Schema.optional(Schema.boolean, {
    description:
      "Whether or not @example tags for each module export should be required. (Note: examples will not be enforced in module documentation)",
    default: false
  }),
  enforceVersion: Schema.optional(Schema.boolean, {
    description: "Whether or not @since tags for each module export should be required.",
    default: true
  }),
  exclude: Schema.optional(Schema.array(Schema.string), {
    description:
      "An array of glob strings specifying files that should be excluded from the documentation.",
    default: []
  }),
  parseCompilerOptions: Schema.optional(
    Schema.union(Schema.string, Schema.record(Schema.string, Schema.unknown)),
    {
      description: "tsconfig for parsing options (or path to a tsconfig)",
      default: {}
    }
  ),
  examplesCompilerOptions: Schema.optional(
    Schema.union(Schema.string, Schema.record(Schema.string, Schema.unknown)),
    {
      description: "tsconfig for the examples options (or path to a tsconfig)",
      default: {}
    }
  )
})

/**
 * @category service
 * @since 1.0.0
 */
export interface Config {
  readonly projectName: string
  readonly projectHomepage: string
  readonly srcDir: string
  readonly outDir: string
  readonly theme: string
  readonly enableSearch: boolean
  readonly enforceDescriptions: boolean
  readonly enforceExamples: boolean
  readonly enforceVersion: boolean
  readonly exclude: ReadonlyArray<string>
  readonly parseCompilerOptions: Record<string, unknown>
  readonly examplesCompilerOptions: Record<string, unknown>
}

/**
 * @category service
 * @since 1.0.0
 */
export const Config = Context.Tag<Config>()

const PackageJsonSchema = Schema.struct({
  name: Schema.string,
  homepage: Schema.string
})

const validateJsonFile = <I, A>(
  schema: Schema.Schema<I, A>,
  path: string
): Effect.Effect<FileSystem.FileSystem, Error, A> =>
  Effect.gen(function*(_) {
    const content = yield* _(FileSystem.readJsonFile(path))
    return yield* _(
      Schema.parse(schema)(content),
      Effect.mapError((e) =>
        new Error(`[Config] Invalid config:\n${TreeFormatter.formatErrors(e.errors)}`)
      )
    )
  })

const defaultCompilerOptions = {
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

/** @internal */
export const getDefaultConfig = (name: string, homepage: string): Config => ({
  projectName: name,
  projectHomepage: homepage,
  srcDir: "src",
  outDir: "docs",
  theme: "mikearnaldi/just-the-docs",
  enableSearch: true,
  enforceDescriptions: false,
  enforceExamples: false,
  enforceVersion: true,
  exclude: [],
  parseCompilerOptions: defaultCompilerOptions,
  examplesCompilerOptions: defaultCompilerOptions
})

const loadConfig = (
  path: string
): Effect.Effect<
  FileSystem.FileSystem,
  Error,
  Option.Option<Schema.Schema.To<typeof ConfigSchema>>
> =>
  Effect.gen(function*(_) {
    const fs = yield* _(FileSystem.FileSystem)
    const exists = yield* _(fs.exists(path))
    if (exists) {
      const config = yield* _(validateJsonFile(ConfigSchema, path))
      return Option.some(config)
    } else {
      return Option.none()
    }
  })

/**
 * @category layer
 * @since 1.0.0
 */
export const ConfigLive = Layer.effect(
  Config,
  Effect.gen(function*(_) {
    // Extract the requisite services
    const process = yield* _(Process.Process)
    const cwd = yield* _(process.cwd)
    const path = yield* _(Path.Path)

    // Read and parse the package.json
    const packageJsonPath = path.join(cwd, PACKAGE_JSON_FILE_NAME)
    const packageJson = yield* _(validateJsonFile(PackageJsonSchema, packageJsonPath))

    // Read and resolve the configuration
    const defaultConfig = getDefaultConfig(packageJson.name, packageJson.homepage)
    const configPath = path.join(cwd, CONFIG_FILE_NAME)
    const maybeConfig = yield* _(loadConfig(configPath))

    if (Option.isNone(maybeConfig)) {
      yield* _(
        Effect.logInfo(chalk.bold("No configuration file detected, using default configuration"))
      )
      return Config.of(defaultConfig)
    }

    yield* _(Effect.logInfo(chalk.bold("Configuration file found")))

    // Allow the user to provide a path to a tsconfig.json file to resolve the compiler options
    const examplesCompilerOptions = yield* _(
      resolveCompilerOptions(cwd, maybeConfig.value.examplesCompilerOptions)
    )
    const parseCompilerOptions = yield* _(
      resolveCompilerOptions(cwd, maybeConfig.value.parseCompilerOptions)
    )

    return Config.of(
      {
        ...defaultConfig,
        ...maybeConfig.value,
        examplesCompilerOptions,
        parseCompilerOptions
      }
    )
  })
)

function resolveCompilerOptions(
  cwd: string,
  options?: string | Record<string, unknown>
): Effect.Effect<
  Path.Path,
  Error,
  {
    readonly [x: string]: unknown
  }
> {
  if (options === undefined) {
    return Effect.succeed(defaultCompilerOptions)
  }
  if (typeof options === "object") {
    return Effect.succeed(options)
  }

  return Effect.flatMap(Path.Path, (_) =>
    Effect.tryPromise({
      try: () =>
        tsconfck.parse(_.resolve(cwd, options)).then(({ tsconfig }) =>
          tsconfig.compilerOptions ?? defaultCompilerOptions
        ),
      catch: (error) => new Error(`[Config] Failed to resolve ${options}: ${String(error)}`)
    }))
}
