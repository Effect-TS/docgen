/**
 * @since 1.0.0
 */

import * as PlatformFileSystem from "@effect/platform-node/FileSystem"
import chalk from "chalk"
import { Effect, Layer, Logger, LogLevel, pipe, ReadonlyArray, String } from "effect"
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

const readFiles = Effect.all([Config.Config, FileSystem.FileSystem]).pipe(
  Effect.flatMap(([config, fileSystem]) =>
    fileSystem.glob(join(config.srcDir, "**", "*.ts"), config.exclude).pipe(
      Effect.tap((paths) => Effect.logInfo(chalk.bold(`${paths.length} module(s) found`))),
      Effect.flatMap(
        Effect.forEach((path) =>
          Effect.map(
            fileSystem.readFile(path),
            (content) => FileSystem.createFile(path, content, false)
          ), { concurrency: "inherit" })
      )
    )
  )
)

const writeFile = (
  file: FileSystem.File
): Effect.Effect<Config.Config | FileSystem.FileSystem | Process.Process, Error, void> =>
  Effect.all([Config.Config, FileSystem.FileSystem, Process.Process]).pipe(
    Effect.flatMap(([config, fileSystem, process]) =>
      process.cwd.pipe(
        Effect.map((cwd) => NodePath.relative(NodePath.join(cwd, config.outDir), file.path)),
        Effect.flatMap((fileName) => {
          const overwrite = Effect.flatMap(
            Effect.logDebug(`overwriting file ${chalk.black(fileName)}`),
            () => fileSystem.writeFile(file.path, file.content)
          )

          const skip = Effect.logDebug(
            `file ${chalk.black(fileName)} already exists, skipping creation`
          )

          const write = fileSystem.writeFile(file.path, file.content)

          return Effect.if(fileSystem.pathExists(file.path), {
            onTrue: file.isOverwriteable ? overwrite : skip,
            onFalse: write
          })
        })
      )
    )
  )

// -------------------------------------------------------------------------------------
// parse
// -------------------------------------------------------------------------------------

const getModules = (files: ReadonlyArray<FileSystem.File>) =>
  Parser.parseFiles(files).pipe(
    Effect.mapError((errors) =>
      new Error(
        `The following error(s) occurred while parsing the TypeScript source files:\n${
          errors.map((errors) => errors.join("\n")).join("\n")
        }`
      )
    )
  )

// -------------------------------------------------------------------------------------
// typeCheckExamples
// -------------------------------------------------------------------------------------

const typeCheckExamples = (modules: ReadonlyArray<Domain.Module>) =>
  getExampleFiles(modules)
    .pipe(
      Effect.flatMap(handleImports),
      Effect.flatMap((examples) =>
        examples.length === 0
          ? cleanExamples
          : writeExamples(examples).pipe(
            Effect.zipRight(writeTsConfigJson),
            Effect.zipRight(spawnTsNode),
            Effect.zipRight(cleanExamples)
          )
      )
    )

const getExampleFiles = (modules: ReadonlyArray<Domain.Module>) =>
  Effect.map(Config.Config, (config) =>
    ReadonlyArray.flatMap(modules, (module) => {
      const prefix = module.path.join("-")

      const getDocumentableExamples = (id: string) =>
      (
        documentable: Domain.Documentable
      ): ReadonlyArray<FileSystem.File> =>
        ReadonlyArray.map(
          documentable.examples,
          (content, i) =>
            FileSystem.createFile(
              join(
                config.outDir,
                "examples",
                `${prefix}-${id}-${documentable.name}-${i}.ts`
              ),
              `${content}\n`,
              true
            )
        )

      const moduleExamples = getDocumentableExamples("module")(module)
      const methods = ReadonlyArray.flatMap(module.classes, (c) =>
        ReadonlyArray.flatten([
          ReadonlyArray.flatMap(
            c.methods,
            getDocumentableExamples(`${c.name}-method`)
          ),
          ReadonlyArray.flatMap(
            c.staticMethods,
            getDocumentableExamples(`${c.name}-staticmethod`)
          )
        ]))
      const interfaces = ReadonlyArray.flatMap(
        module.interfaces,
        getDocumentableExamples("interface")
      )
      const typeAliases = ReadonlyArray.flatMap(
        module.typeAliases,
        getDocumentableExamples("typealias")
      )
      const constants = ReadonlyArray.flatMap(
        module.constants,
        getDocumentableExamples("constant")
      )
      const functions = ReadonlyArray.flatMap(
        module.functions,
        getDocumentableExamples("function")
      )

      return ReadonlyArray.flatten([
        moduleExamples,
        methods,
        interfaces,
        typeAliases,
        constants,
        functions
      ])
    }))

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
    replaceProjectName(file.content).pipe(
      Effect.map(addAssertImport),
      Effect.map((content) => FileSystem.createFile(file.path, content, file.isOverwriteable))
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
    FileSystem.createFile(
      join(config.outDir, "examples", "index.ts"),
      `${content}\n`,
      true
    ))
}

const cleanExamples = Effect.flatMap(
  Effect.all([Config.Config, FileSystem.FileSystem]),
  ([config, fileSystem]) => fileSystem.removeFile(join(config.outDir, "examples"))
)

const spawnTsNode = Effect.logDebug("Type checking examples...").pipe(
  Effect.flatMap(() => Effect.all([ChildProcess.ChildProcess, Config.Config, Process.Process])),
  Effect.flatMap(([childProcess, config, process]) =>
    Effect.all([process.cwd, process.platform]).pipe(
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
  Effect.logDebug("Writing examples...").pipe(
    Effect.flatMap(() => getExampleIndex(examples)),
    Effect.map((index) => pipe(examples, ReadonlyArray.prepend(index))),
    Effect.flatMap(writeFiles)
  )

const writeTsConfigJson = Effect.logDebug("Writing examples tsconfig...").pipe(
  Effect.flatMap(() => Effect.all([Config.Config, Process.Process])),
  Effect.flatMap(([config, process]) =>
    process.cwd.pipe(
      Effect.flatMap((cwd) =>
        writeFile(
          FileSystem.createFile(
            join(cwd, config.outDir, "examples", "tsconfig.json"),
            JSON.stringify({ compilerOptions: config.examplesCompilerOptions }, null, 2),
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
  Effect.Do.pipe(
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

const getHome = Effect.all([Config.Config, Process.Process]).pipe(
  Effect.flatMap(([config, process]) =>
    process.cwd.pipe(
      Effect.map((cwd) =>
        FileSystem.createFile(
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

const getModulesIndex = Effect.all([Config.Config, Process.Process]).pipe(
  Effect.flatMap(([config, process]) =>
    process.cwd
      .pipe(
        Effect.map((cwd) =>
          FileSystem.createFile(
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

const getConfigYML = Effect.all([Config.Config, FileSystem.FileSystem, Process.Process]).pipe(
  Effect.flatMap(([config, fileSystem, process]) =>
    Effect.flatMap(process.cwd, (cwd) => {
      const filePath = join(cwd, config.outDir, "_config.yml")
      return fileSystem.pathExists(filePath).pipe(
        Effect.flatMap((exists) =>
          exists
            ? Effect.map(
              fileSystem.readFile(filePath),
              (content) =>
                FileSystem.createFile(
                  filePath,
                  resolveConfigYML(content, config),
                  true
                )
            )
            : Effect.succeed(
              FileSystem.createFile(
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
    Effect.Do
      .pipe(
        Effect.bind("outputPath", () => getMarkdownOutputPath(module)),
        Effect.bind("content", () => Effect.succeed(printModule(module, order + 1))),
        Effect.map(({ content, outputPath }) => FileSystem.createFile(outputPath, content, true))
      ))

// -------------------------------------------------------------------------------------
// writeMarkdown
// -------------------------------------------------------------------------------------

const writeMarkdown = (files: ReadonlyArray<FileSystem.File>) =>
  Effect.gen(function*(_) {
    const config = yield* _(Config.Config)
    const fileSystem = yield* _(FileSystem.FileSystem)
    const pattern = join(config.outDir, "**/*.ts.md")
    yield* _(Effect.logDebug(`deleting ${chalk.black(pattern)}`))
    const paths = yield* _(fileSystem.glob(pattern))
    yield* _(
      Effect.forEach(paths, (path) => fileSystem.removeFile(path), { concurrency: "unbounded" })
    )
    return yield* _(writeFiles(files))
  })

const program = Effect.gen(function*(_) {
  yield* _(Effect.logInfo("Reading modules..."))
  const sourceFiles = yield* _(readFiles)
  yield* _(Effect.logInfo("Parsing modules..."))
  const modules = yield* _(getModules(sourceFiles))
  yield* _(Effect.logInfo("Typechecking examples..."))
  yield* _(typeCheckExamples(modules))
  yield* _(Effect.logInfo("Creating markdown files..."))
  const outputFiles = yield* _(getMarkdown(modules))
  yield* _(Effect.logInfo("Writing markdown files..."))
  yield* _(writeMarkdown(outputFiles))
  yield* _(Effect.logInfo(chalk.bold.green("Docs generation succeeded!")))
}).pipe(Logger.withMinimumLogLevel(LogLevel.Debug))

const MainLayer = Layer.mergeAll(
  Logger.replace(Logger.defaultLogger, SimpleLogger),
  ChildProcess.ChildProcessLive,
  FileSystem.FileSystemLive,
  Process.ProcessLive
).pipe(
  Layer.provideMerge(Config.ConfigLive),
  Layer.use(PlatformFileSystem.layer)
)

const runnable = program.pipe(Effect.provide(MainLayer))

/**
 * @category main
 * @since 1.0.0
 */
export const main: Effect.Effect<never, never, void> = runnable.pipe(
  Effect.catchAll((error) => Effect.dieMessage(error.message))
)
