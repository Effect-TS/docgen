/**
 * @since 1.0.0
 */

import * as Data from "@effect/data/Data"
import { pipe } from "@effect/data/Function"
import * as ReadonlyArray from "@effect/data/ReadonlyArray"
import * as String from "@effect/data/String"
import * as Effect from "@effect/io/Effect"
import * as Layer from "@effect/io/Layer"
import * as Logger from "@effect/io/Logger"
import * as LogLevel from "@effect/io/Logger/Level"
import chalk from "chalk"
import * as NodePath from "path"
import * as ChildProcess from "./ChildProcess"
import * as Config from "./Config"
import type * as Domain from "./Domain"
import * as FileSystem from "./FileSystem"
import { SimpleLogger } from "./Logger"
import { printModule } from "./Markdown"
import * as Parser from "./Parser"
import * as Process from "./Process"

// -------------------------------------------------------------------------------------
// readFiles
// -------------------------------------------------------------------------------------

const join = (...paths: Array<string>): string => NodePath.normalize(NodePath.join(...paths))

const readFiles = pipe(
  Effect.all([Config.Config, FileSystem.FileSystem]),
  Effect.flatMap(([config, fileSystem]) =>
    pipe(
      fileSystem.glob(join(config.srcDir, "**", "*.ts"), config.exclude),
      Effect.tap((paths) => Effect.logInfo(chalk.bold(`${paths.length} module(s) found`))),
      Effect.flatMap(
        Effect.forEach((path) =>
          Effect.map(
            fileSystem.readFile(path),
            (content) => FileSystem.makeFile(path, content, false)
          ), { concurrency: "inherit" })
      )
    )
  )
)

const writeFile = (
  file: FileSystem.File
): Effect.Effect<
  Config.Config | FileSystem.FileSystem | Process.Process,
  FileSystem.ReadFileError | FileSystem.WriteFileError,
  void
> =>
  pipe(
    Effect.all([Config.Config, FileSystem.FileSystem, Process.Process]),
    Effect.flatMap(([config, fileSystem, process]) =>
      pipe(
        process.cwd,
        Effect.map((cwd) => NodePath.relative(NodePath.join(cwd, config.outDir), file.path)),
        Effect.flatMap((fileName) => {
          const overwrite = pipe(
            Effect.logDebug(`overwriting file ${chalk.black(fileName)}`),
            Effect.flatMap(() => fileSystem.writeFile(file.path, file.content))
          )

          const skip = Effect.logDebug(
            `file ${chalk.black(fileName)} already exists, skipping creation`
          )

          const write = fileSystem.writeFile(file.path, file.content)

          return Effect.if(fileSystem.pathExists(file.path), {
            onTrue: file.overwrite ? overwrite : skip,
            onFalse: write
          })
        })
      )
    )
  )

// -------------------------------------------------------------------------------------
// parse
// -------------------------------------------------------------------------------------

/**
 * Represents errors that occurred during parsing of TypeScript source files.
 *
 * @category model
 * @since 1.0.0
 */
export interface ParseError extends Data.Case {
  readonly _tag: "ParseError"
  readonly message: string
}

/**
 * @category constructors
 * @since 1.0.0
 */
export const ParseError = Data.tagged<ParseError>("ParseError")

const getModules = (files: ReadonlyArray<FileSystem.File>) =>
  pipe(
    Parser.parseFiles(files),
    Effect.mapError((errors) =>
      ParseError({
        message: errors
          .map((errors) => errors.join("\n"))
          .join("\n")
      })
    )
  )

// -------------------------------------------------------------------------------------
// typeCheckExamples
// -------------------------------------------------------------------------------------

const typeCheckExamples = (modules: ReadonlyArray<Domain.Module>) =>
  pipe(
    getExampleFiles(modules),
    Effect.flatMap(handleImports),
    Effect.flatMap((examples) =>
      examples.length === 0
        ? cleanExamples
        : pipe(
          writeExamples(examples),
          Effect.flatMap(() => writeTsConfigJson),
          Effect.flatMap(() => spawnTsNode),
          Effect.flatMap(() => cleanExamples)
        )
    )
  )

const getExampleFiles = (modules: ReadonlyArray<Domain.Module>) =>
  Effect.map(Config.Config, (config) =>
    pipe(
      modules,
      ReadonlyArray.flatMap((module) => {
        const prefix = module.path.join("-")

        const getDocumentableExamples = (id: string) =>
        (
          documentable: Domain.Documentable
        ): ReadonlyArray<FileSystem.File> =>
          pipe(
            documentable.examples,
            ReadonlyArray.map((content, i) =>
              FileSystem.makeFile(
                join(
                  config.outDir,
                  "examples",
                  `${prefix}-${id}-${documentable.name}-${i}.ts`
                ),
                `${content}\n`,
                true
              )
            )
          )

        const moduleExamples = getDocumentableExamples("module")(module)
        const methods = pipe(
          module.classes,
          ReadonlyArray.flatMap((c) =>
            ReadonlyArray.flatten([
              pipe(
                c.methods,
                ReadonlyArray.flatMap(
                  getDocumentableExamples(`${c.name}-method`)
                )
              ),
              pipe(
                c.staticMethods,
                ReadonlyArray.flatMap(
                  getDocumentableExamples(`${c.name}-staticmethod`)
                )
              )
            ])
          )
        )
        const interfaces = pipe(
          module.interfaces,
          ReadonlyArray.flatMap(getDocumentableExamples("interface"))
        )
        const typeAliases = pipe(
          module.typeAliases,
          ReadonlyArray.flatMap(getDocumentableExamples("typealias"))
        )
        const constants = pipe(
          module.constants,
          ReadonlyArray.flatMap(getDocumentableExamples("constant"))
        )
        const functions = pipe(
          module.functions,
          ReadonlyArray.flatMap(getDocumentableExamples("function"))
        )

        return ReadonlyArray.flatten([
          moduleExamples,
          methods,
          interfaces,
          typeAliases,
          constants,
          functions
        ])
      })
    ))

const addAssertImport = (code: string): string =>
  code.indexOf("assert.") !== -1
    ? `import * as assert from 'assert'\n${code}`
    : code

const replaceProjectName = (source: string) =>
  Effect.map(Config.Config, (config) => {
    const importRegex = (projectName: string) =>
      new RegExp(
        `from (?<quote>['"])${projectName}(?:/lib)?(?:/(?<path>.*))?\\k<quote>`,
        "g"
      )

    const out = source.replace(importRegex(config.projectName), (...args) => {
      const groups: { path?: string } = args[args.length - 1]
      return `from '../../src${groups.path ? `/${groups.path}` : ""}'`
    })

    return out
  })

const handleImports = (files: ReadonlyArray<FileSystem.File>) =>
  Effect.forEach(files, (file) =>
    pipe(
      replaceProjectName(file.content),
      Effect.map(addAssertImport),
      Effect.map((content) => FileSystem.makeFile(file.path, content, file.overwrite))
    ))

const getExampleIndex = (examples: ReadonlyArray<FileSystem.File>) => {
  const content = pipe(
    examples,
    ReadonlyArray.map(
      (example) => `import './${NodePath.basename(example.path, ".ts")}'`
    ),
    ReadonlyArray.join("\n")
  )
  return Effect.map(Config.Config, (config) =>
    FileSystem.makeFile(
      join(config.outDir, "examples", "index.ts"),
      `${content}\n`,
      true
    ))
}

const cleanExamples = Effect.flatMap(
  Effect.all([Config.Config, FileSystem.FileSystem]),
  ([config, fileSystem]) => fileSystem.removeFile(join(config.outDir, "examples"))
)

const spawnTsNode = pipe(
  Effect.logDebug("Type checking examples..."),
  Effect.flatMap(() => Effect.all([ChildProcess.ChildProcess, Config.Config, Process.Process])),
  Effect.flatMap(([childProcess, config, process]) =>
    pipe(
      Effect.all([process.cwd, process.platform]),
      Effect.flatMap(([cwd, platform]) => {
        const command = platform === "win32" ? "ts-node.cmd" : "ts-node"
        const executable = join(cwd, config.outDir, "examples", "index.ts")
        return childProcess.spawn(command, executable)
      })
    )
  )
)

const writeFiles = (
  files: ReadonlyArray<FileSystem.File>
) => Effect.forEach(files, writeFile, { discard: true })

const writeExamples = (examples: ReadonlyArray<FileSystem.File>) =>
  pipe(
    Effect.logDebug("Writing examples..."),
    Effect.flatMap(() => getExampleIndex(examples)),
    Effect.map((index) => pipe(examples, ReadonlyArray.prepend(index))),
    Effect.flatMap(writeFiles)
  )

const writeTsConfigJson = pipe(
  Effect.logDebug("Writing examples tsconfig..."),
  Effect.flatMap(() => Effect.all([Config.Config, Process.Process])),
  Effect.flatMap(([config, process]) =>
    pipe(
      process.cwd,
      Effect.flatMap((cwd) =>
        writeFile(
          FileSystem.makeFile(
            join(cwd, config.outDir, "examples", "tsconfig.json"),
            JSON.stringify(
              {
                compilerOptions: config.examplesCompilerOptions
              },
              null,
              2
            ),
            true
          )
        )
      )
    )
  )
)

// -------------------------------------------------------------------------------------
// getMarkdown
// -------------------------------------------------------------------------------------

const getMarkdown = (modules: ReadonlyArray<Domain.Module>) =>
  pipe(
    Effect.Do,
    Effect.bind("home", () => getHome),
    Effect.bind("index", () => getModulesIndex),
    Effect.bind("yml", () => getConfigYML),
    Effect.flatMap(({ home, index, yml }) =>
      pipe(
        getModuleMarkdownFiles(modules),
        Effect.map((files) => [home, index, yml].concat(files))
      )
    )
  )

const getHome = pipe(
  Effect.all([Config.Config, Process.Process]),
  Effect.flatMap(([config, process]) =>
    pipe(
      process.cwd,
      Effect.map((cwd) =>
        FileSystem.makeFile(
          join(cwd, config.outDir, "index.md"),
          String.stripMargin(
            `|---
             |title: Home
             |nav_order: 1
             |---
             |`
          ),
          false
        )
      )
    )
  )
)

const getModulesIndex = pipe(
  Effect.all([Config.Config, Process.Process]),
  Effect.flatMap(([config, process]) =>
    pipe(
      process.cwd,
      Effect.map((cwd) =>
        FileSystem.makeFile(
          join(cwd, config.outDir, "modules", "index.md"),
          String.stripMargin(
            `|---
             |title: Modules
             |has_children: true
             |permalink: /docs/modules
             |nav_order: 2
             |---
             |`
          ),
          false
        )
      )
    )
  )
)

const replace = (
  searchValue: string | RegExp,
  replaceValue: string
): (s: string) => string =>
(s) => s.replace(searchValue, replaceValue)

const resolveConfigYML = (
  previousContent: string,
  config: Config.Config
): string =>
  pipe(
    previousContent,
    replace(/^remote_theme:.*$/m, `remote_theme: ${config.theme}`),
    replace(/^search_enabled:.*$/m, `search_enabled: ${config.enableSearch}`),
    replace(
      /^ {2}'\S* on GitHub':\n {4}- '.*'/m,
      `  '${config.projectName} on GitHub':\n    - '${config.projectHomepage}'`
    )
  )

const getHomepageNavigationHeader = (config: Config.Config): string => {
  const isGitHub = config.projectHomepage.toLowerCase().includes("github")
  return isGitHub ? config.projectName + " on GitHub" : "Homepage"
}

const getConfigYML = pipe(
  Effect.all([Config.Config, FileSystem.FileSystem, Process.Process]),
  Effect.flatMap(([config, fileSystem, process]) =>
    Effect.flatMap(process.cwd, (cwd) => {
      const filePath = join(cwd, config.outDir, "_config.yml")
      return pipe(
        fileSystem.pathExists(filePath),
        Effect.flatMap((exists) =>
          exists
            ? pipe(
              fileSystem.readFile(filePath),
              Effect.map((content) =>
                FileSystem.makeFile(
                  filePath,
                  resolveConfigYML(content, config),
                  true
                )
              )
            )
            : Effect.succeed(
              FileSystem.makeFile(
                filePath,
                String.stripMargin(
                  `|remote_theme: ${config.theme}
                   |
                   |# Enable or disable the site search
                   |search_enabled: ${config.enableSearch}
                   |
                   |# Aux links for the upper right navigation
                   |aux_links:
                   |'${getHomepageNavigationHeader(config)}':
                   |  - '${config.projectHomepage}'`
                ),
                false
              )
            )
        )
      )
    })
  )
)

const getMarkdownOutputPath = (module: Domain.Module) =>
  Effect.map(Config.Config, (config) =>
    join(
      config.outDir,
      "modules",
      `${module.path.slice(1).join(NodePath.sep)}.md`
    ))

const getModuleMarkdownFiles = (modules: ReadonlyArray<Domain.Module>) =>
  Effect.forEach(modules, (module, order) =>
    pipe(
      Effect.Do,
      Effect.bind("outputPath", () => getMarkdownOutputPath(module)),
      Effect.bind("content", () => Effect.succeed(printModule(module, order + 1))),
      Effect.map(({ content, outputPath }) => FileSystem.makeFile(outputPath, content, true))
    ))

// -------------------------------------------------------------------------------------
// writeMarkdown
// -------------------------------------------------------------------------------------

const writeMarkdown = (files: ReadonlyArray<FileSystem.File>) =>
  pipe(
    Effect.map(Config.Config, (config) => join(config.outDir, "**/*.ts.md")),
    Effect.tap((pattern) => Effect.logDebug(`deleting ${chalk.black(pattern)}`)),
    Effect.flatMap((pattern) =>
      Effect.flatMap(FileSystem.FileSystem, (fileSystem) => fileSystem.removeFile(pattern))
    ),
    Effect.flatMap(() => writeFiles(files))
  )

const MainLayer = pipe(
  Logger.replace(Logger.defaultLogger, SimpleLogger),
  Layer.merge(ChildProcess.ChildProcessLive),
  Layer.merge(FileSystem.FileSystemLive),
  Layer.merge(Process.ProcessLive),
  Layer.provideMerge(Config.ConfigLive)
)

/**
 * @category main
 * @since 1.0.0
 */
export const main: Effect.Effect<never, never, void> = pipe(
  Effect.logInfo("reading modules..."),
  Effect.zipRight(readFiles),
  Effect.zipLeft(Effect.logInfo("parsing modules...")),
  Effect.flatMap(getModules),
  Effect.zipLeft(Effect.logInfo("typechecking examples...")),
  Effect.tap(typeCheckExamples),
  Effect.zipLeft(Effect.logInfo("creating markdown files...")),
  Effect.flatMap(getMarkdown),
  Effect.zipLeft(Effect.logInfo("writing markdown files...")),
  Effect.flatMap(writeMarkdown),
  Effect.zipLeft(Effect.logInfo(chalk.bold.green("Docs generation succeeded!"))),
  Logger.withMinimumLogLevel(LogLevel.Debug),
  Effect.provideLayer(MainLayer),
  Effect.catchTags({
    // Configuration errors
    ConfigError: ({ message }) => Effect.dieMessage(message),
    // File system errors
    ReadFileError: ({ path }) => Effect.dieMessage(`Unable to read file from: '${path}'`),
    WriteFileError: ({ path }) => Effect.dieMessage(`Unable to write file to: '${path}'`),
    RemoveFileError: ({ path }) => Effect.dieMessage(`Unable to remove file from: '${path}'`),
    GlobError: ({ exclude, pattern }) =>
      Effect.dieMessage(
        `Unable to execute glob pattern '${pattern}' excluding files matching '${exclude}'`
      ),
    // Child process errors
    ExecutionError: ({ command, stderr }) =>
      Effect.dieMessage(
        `During execution of '${command}', the following error occurred:\n${stderr}`
      ),
    SpawnError: ({ args, command, error }) =>
      Effect.dieMessage(
        `Unable to spawn child process for command: '${command} ${args.join(" ")}'\n${error}`
      ),
    // Parsing errors
    ParseJsonError: ({ content }) => Effect.dieMessage(`Unable to parse JSON: ${content}`),
    ParseError: ({ message }) =>
      Effect.dieMessage(
        `The following error(s) occurred while parsing the TypeScript source files:\n${message}`
      )
  })
)
