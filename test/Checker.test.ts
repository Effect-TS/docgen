import * as Checker from "@effect/docgen/Checker"
import * as Configuration from "@effect/docgen/Configuration"
import * as Parser from "@effect/docgen/Parser"
import { Path } from "@effect/platform"
import chalk from "chalk"
import { Effect, Predicate } from "effect"
import * as assert from "node:assert/strict"
import * as ast from "ts-morph"
import { describe, it } from "vitest"

let testCounter = 0

const project = new ast.Project({
  compilerOptions: { strict: true },
  useInMemoryFileSystem: true
})

const defaultConfig: Configuration.ConfigurationShape = {
  projectName: "docgen",
  projectHomepage: "https://github.com/effect-ts/docgen",
  srcLink: "https://github.com/effect-ts/docgen/blob/main/src/",
  srcDir: "src",
  outDir: "docs",
  theme: "pmarsceill/just-the-docs",
  enableSearch: true,
  enforceDescriptions: false,
  enforceExamples: false,
  enforceVersion: true,
  runExamples: false,
  exclude: [],
  parseCompilerOptions: {},
  examplesCompilerOptions: {}
}

const makeSource = (source: string | ast.SourceFile) => {
  const filename = `test-${testCounter++}`
  return Parser.Source.of({
    path: [filename],
    sourceFile: Predicate.isString(source)
      ? project.createSourceFile(`${filename}.ts`, source)
      : source
  })
}

const expectFailure = <A>(
  config: Partial<Configuration.ConfigurationShape>,
  sourceText: string,
  parser: Effect.Effect<A, never, Parser.Source | Configuration.Configuration | Path.Path>,
  checker: (a: A) => Effect.Effect<Array<string>, never, Configuration.Configuration | Parser.Source>,
  failure: ReadonlyArray<string>
) => {
  const actual = parser.pipe(
    Effect.flatMap(checker),
    Effect.provideService(Parser.Source, makeSource(sourceText)),
    Effect.provideService(Configuration.Configuration, { ...defaultConfig, ...config }),
    Effect.provide(Path.layer),
    Effect.runSyncExit
  )
  assert.ok(actual._tag === "Success")
  // console.log(actual.value)
  assert.deepStrictEqual(actual.value, failure)
}

describe("Checker", () => {
  describe("checkFunctions", () => {
    it("should raise an error if `@since` tag is missing in export", () => {
      expectFailure(
        {},
        `
/** @since 1.0.0 */
export function a() {}

/** description */
export function b() {}
        `,
        Parser.parseFunctions,
        Checker.checkFunctions,
        [`Missing \`@since\` tag in file /test-0.ts:

  4 |
  5 | /** description */
> 6 | export function b() {}
    | ^
  7 |         `]
      )
    })
  })

  describe.skip("checkExports", () => {
    it("should raise an error if `@since` tag is missing in export", () => {
      expectFailure(
        {},
        "export { a }",
        Parser.parseExports,
        Checker.checkExports,
        ["Missing `@since` tag in export: a"]
      )
    })
  })

  describe.skip("checkNamespaces", () => {
    it("should raise an error if the namespace is not well documented", () => {
      expectFailure(
        {},
        "export namespace A {}",
        Parser.parseNamespaces,
        Checker.checkNamespaces,
        [
          `Missing ${chalk.bold("@since")} tag in ${chalk.bold("test#A")} documentation`
        ]
      )
    })

    it("should raise an error if the interface is not well documented", () => {
      expectFailure(
        {},
        `
      /**
       * @since 1.0.0
       */
      export namespace A {
        export interface B {}
      }
      `,
        Parser.parseNamespaces,
        Checker.checkNamespaces,
        [`Missing ${chalk.bold("@since")} tag in ${chalk.bold("test#B")} documentation`]
      )
    })

    it("should raise an error if the type alias is not well documented", () => {
      expectFailure(
        {},
        `
      /**
       * @since 1.0.0
       */
      export namespace A {
        export type B = string
      }
      `,
        Parser.parseNamespaces,
        Checker.checkNamespaces,
        [`Missing ${chalk.bold("@since")} tag in ${chalk.bold("test#B")} documentation`]
      )
    })

    it("should raise an error if the namespace is not well documented", () => {
      expectFailure(
        {},
        `
      /**
       * @since 1.0.0
       */
      export namespace A {
        export namespace B {}
      }
      `,
        Parser.parseNamespaces,
        Checker.checkNamespaces,
        [`Missing ${chalk.bold("@since")} tag in ${chalk.bold("test#B")} documentation`]
      )
    })
  })

  describe.skip("checkClasses", () => {
    it("should raise an error if an `@since` tag is missing in a module", () => {
      expectFailure(
        {},
        `export class MyClass {}`,
        Parser.parseClasses,
        Checker.checkClasses,
        [
          `Missing ${chalk.bold("@since")} tag in ${chalk.bold("test#MyClass")} documentation`
        ]
      )
    })
    it("should raise an error if `@since` is missing in a property", () => {
      expectFailure(
        {},
        `/**
          * @since 1.0.0
          */
          export class MyClass<A> {
            readonly _A!: A
          }`,
        Parser.parseClasses,
        Checker.checkClasses,
        [`Missing ${chalk.bold("@since")} tag in ${chalk.bold("test#MyClass#_A")} documentation`]
      )
    })
  })
})
