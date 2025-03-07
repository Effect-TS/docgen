import * as Configuration from "@effect/docgen/Configuration"
import * as Domain from "@effect/docgen/Domain"
import * as Parser from "@effect/docgen/Parser"
import * as Printer from "@effect/docgen/Printer"
import { Path } from "@effect/platform"
import chalk from "chalk"
import { Effect, Exit } from "effect"
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

const makeSourceFromString = (sourceText: string) =>
  Parser.Source.of({
    path: ["test"],
    sourceFile: project.createSourceFile(`test-${testCounter++}.ts`, sourceText)
  })

const makeSourceFromSourceFile = (sourceFile: ast.SourceFile) =>
  Parser.Source.of({
    path: ["test"],
    sourceFile
  })

const expectFailure = <A, E>(
  sourceText: string,
  eff: Effect.Effect<A, E, Parser.Source | Configuration.Configuration | Path.Path>,
  failure: E,
  config?: Partial<Configuration.ConfigurationShape>
) => {
  assert.deepStrictEqual(
    eff.pipe(
      Effect.provideService(Parser.Source, makeSourceFromString(sourceText)),
      Effect.provideService(Configuration.Configuration, { ...defaultConfig, ...config }),
      Effect.provide(Path.layer),
      Effect.runSyncExit
    ),
    Exit.fail(failure)
  )
}

const expectSuccess = <A, E>(
  sourceText: string,
  eff: Effect.Effect<A, E, Parser.Source | Configuration.Configuration | Path.Path>,
  expected: A,
  config?: Partial<Configuration.ConfigurationShape>
) => {
  const exit = eff.pipe(
    Effect.provideService(Parser.Source, makeSourceFromString(sourceText)),
    Effect.provideService(Configuration.Configuration, { ...defaultConfig, ...config }),
    Effect.provide(Path.layer),
    Effect.runSyncExit
  )
  assert.ok(exit._tag === "Success")
  assert.deepStrictEqual(exit.value, expected)
}

const print = (printables: ReadonlyArray<Printer.Printable>) => {
  const raw = printables.map((printable) => Printer.print(printable).trim()).join("\n")
  return Effect.succeed(raw)
  // return Printer.prettify(raw)
}

const expectMarkdown = async <E>(
  eff: Effect.Effect<
    Printer.Printable | ReadonlyArray<Printer.Printable>,
    E,
    Parser.Source | Configuration.Configuration | Path.Path
  >,
  sourceText: string,
  expected: string
) => {
  const exit = await eff.pipe(
    Effect.flatMap((a) => {
      return print(Array.isArray(a) ? a : [a])
    }),
    Effect.provideService(Parser.Source, makeSourceFromString(sourceText)),
    Effect.provideService(Configuration.Configuration, defaultConfig),
    Effect.provide(Path.layer),
    Effect.runPromiseExit
  )
  assert.ok(exit._tag === "Success")
  if (exit.value !== expected) {
    console.log(exit.value)
  }
  assert.strictEqual(exit.value, expected)
}

describe("Parser", () => {
  describe("parseFunctions", () => {
    it("should raise an error if the function is anonymous", () => {
      expectFailure(
        `export function(a: number, b: number): number { return a + b }`,
        Parser.parseFunctions,
        [`Missing ${chalk.bold("function name")} in module ${chalk.bold("test")}`]
      )
    })

    it("description", async () => {
      await expectMarkdown(
        Parser.parseFunctions,
        `/**
         * description...
         * @since 1.2.0
         */
        export function myfunc() {}`,
        `## myfunc

description...

**Signature**

\`\`\`ts
export declare function myfunc()
\`\`\`

Since v1.2.0`
      )
    })

    it("throws", async () => {
      await expectMarkdown(
        Parser.parseFunctions,
        `/**
         * description...
         * @throws \`Error1\` - Description 1
         * @throws \`Error2\` - Description 2
         * @since 1.2.0
         */
        export function myfunc() {}`,
        `## myfunc

description...

**Throws**

\`Error1\` - Description 1
\`Error2\` - Description 2

**Signature**

\`\`\`ts
export declare function myfunc()
\`\`\`

Since v1.2.0`
      )
    })

    it("example without fence", async () => {
      await expectMarkdown(
        Parser.parseFunctions,
        `/**
         * description...
         * @example
         * const x = 1
         * @since 1.0.0
         */
        export function myfunc() {}`,
        `## myfunc

description...

**Example**

\`\`\`ts
const x = 1
\`\`\`

**Signature**

\`\`\`ts
export declare function myfunc()
\`\`\`

Since v1.0.0`
      )
    })

    it("example with backtick fence", async () => {
      await expectMarkdown(
        Parser.parseFunctions,
        `/**
         * description...
         * @example
         * \`\`\`ts
         * const x = 1
         * \`\`\`
         * @since 1.0.0
         */
        export function myfunc() {}`,
        `## myfunc

description...

**Example**

\`\`\`ts
const x = 1
\`\`\`

**Signature**

\`\`\`ts
export declare function myfunc()
\`\`\`

Since v1.0.0`
      )
    })

    it("2 examples", async () => {
      await expectMarkdown(
        Parser.parseFunctions,
        `/**
         * description...
         * @example
         * \`\`\`ts
         * const x = 1
         * \`\`\`
         * @example
         * \`\`\`ts
         * const x = 2
         * \`\`\`
         * @since 1.0.0
         */
        export function myfunc() {}`,
        `## myfunc

description...

**Example**

\`\`\`ts
const x = 1
\`\`\`

**Example**

\`\`\`ts
const x = 2
\`\`\`

**Signature**

\`\`\`ts
export declare function myfunc()
\`\`\`

Since v1.0.0`
      )
    })

    it("example with metas", async () => {
      await expectMarkdown(
        Parser.parseFunctions,
        `/**
         * description...
         * @example
         * \`\`\`ts a=1
         * const x = 1
         * \`\`\`
         * @since 1.0.0
         */
        export function myfunc() {}`,
        `## myfunc

description...

**Example**

\`\`\`ts a=1
const x = 1
\`\`\`

**Signature**

\`\`\`ts
export declare function myfunc()
\`\`\`

Since v1.0.0`
      )
    })

    it("example with titde fence", async () => {
      await expectMarkdown(
        Parser.parseFunctions,
        `/**
         * description...
         * @example
         * ~~~ts
         * const x = 1
         * ~~~
         * @since 1.0.0
         */
        export function myfunc() {}`,
        `## myfunc

description...

**Example**

~~~ts
const x = 1
~~~

**Signature**

\`\`\`ts
export declare function myfunc()
\`\`\`

Since v1.0.0`
      )
    })

    it("should not return private function declarations", async () => {
      await expectMarkdown(
        Parser.parseFunctions,
        `/**
         * description...
         */
        function myfunc() {}`,
        ""
      )
    })

    it("should not return ignored function declarations", async () => {
      await expectMarkdown(
        Parser.parseFunctions,
        `/**
         * @ignore
         */
        export function myfunc() {}`,
        ""
      )
    })

    it("should not return ignored function declarations with overloads", async () => {
      await expectMarkdown(
        Parser.parseFunctions,
        `/**
          * @ignore
          */
          export function sum(a: number, b: number)
          export function sum(a: number, b: number): number { return a + b }`,
        ""
      )
    })

    it("should not return internal function declarations", async () => {
      await expectMarkdown(
        Parser.parseFunctions,
        `/**
          * @internal
          */
          export function sum(a: number, b: number): number { return a + b }`,
        ""
      )
    })

    it("should not return internal function declarations even with overloads", async () => {
      await expectMarkdown(
        Parser.parseFunctions,
        `/**
          * @internal
          */
          export function sum(a: number, b: number)
          export function sum(a: number, b: number): number { return a + b }`,
        ""
      )
    })

    it("should not return private const function declarations", async () => {
      await expectMarkdown(
        Parser.parseFunctions,
        `const sum = (a: number, b: number): number => a + b `,
        ""
      )
    })

    it("should not return internal const function declarations", async () => {
      await expectMarkdown(
        Parser.parseFunctions,
        `/**
          * @internal
          */
          export const sum = (a: number, b: number): number => a + b `,
        ""
      )
    })

    it("should account for nullable polymorphic return types", async () => {
      await expectMarkdown(
        Parser.parseFunctions,
        `/**
          * @since 1.0.0
          */
         export const toNullable = <A>(ma: A | null): A | null => ma`,
        `## toNullable

**Signature**

\`\`\`ts
export declare const toNullable: <A>(ma: A | null) => A | null
\`\`\`

Since v1.0.0`
      )
    })

    it("should handle a const function declaration", async () => {
      await expectMarkdown(
        Parser.parseFunctions,
        `/**
          * a description...
          * @since 1.0.0
          * @example
          * assert.deepStrictEqual(f(1, 2), { a: 1, b: 2 })
          * @example
          * assert.deepStrictEqual(f(3, 4), { a: 3, b: 4 })
          * @deprecated
          */
          export const f = (a: number, b: number): { [key: string]: number } => ({ a, b })`,
        `## ~~f~~

a description...

**Example**

\`\`\`ts
assert.deepStrictEqual(f(1, 2), { a: 1, b: 2 })
\`\`\`

**Example**

\`\`\`ts
assert.deepStrictEqual(f(3, 4), { a: 3, b: 4 })
\`\`\`

**Signature**

\`\`\`ts
export declare const f: (a: number, b: number) => { [key: string]: number; }
\`\`\`

Since v1.0.0`
      )
    })

    it("should handle a function declaration", async () => {
      await expectMarkdown(
        Parser.parseFunctions,
        `/**
        * @since 1.0.0
        */
        export function f(a: number, b: number): { [key: string]: number } { return { a, b } }`,
        `## f

**Signature**

\`\`\`ts
export declare function f(a: number, b: number): { [key: string]: number }
\`\`\`

Since v1.0.0`
      )
    })

    it("should handle overloadings", async () => {
      await expectMarkdown(
        Parser.parseFunctions,
        `/**
        * a description...
        * @since 1.0.0
        * @deprecated
        */
        export function f(a: Int, b: Int): { [key: string]: number }
        export function f(a: number, b: number): { [key: string]: number }
        export function f(a: any, b: any): { [key: string]: number } { return { a, b } }`,
        `## ~~f~~

a description...

**Signature**

\`\`\`ts
export declare function f(a: Int, b: Int): { [key: string]: number }
export declare function f(a: number, b: number): { [key: string]: number }
\`\`\`

Since v1.0.0`
      )
    })
  })

  describe("parseConstants", () => {
    it("should handle a constant value", async () => {
      await expectMarkdown(
        Parser.parseConstants,
        `/**
          * a description...
          * @since 1.0.0
          * @deprecated
          */
          export const s: string = ''`,
        `## ~~s~~

a description...

**Signature**

\`\`\`ts
export declare const s: string
\`\`\`

Since v1.0.0`
      )
    })

    it("should support constants with default type parameters", async () => {
      await expectMarkdown(
        Parser.parseConstants,
        `/**
          * @since 1.0.0
          */
          export const left: <E = never, A = never>(l: E) => string = T.left`,
        `## left

**Signature**

\`\`\`ts
export declare const left: <E = never, A = never>(l: E) => string
\`\`\`

Since v1.0.0`
      )
    })

    it("should support untyped constants", async () => {
      await expectMarkdown(
        Parser.parseConstants,
        `
      class A {}
    /**
      * @since 1.0.0
      */
      export const empty = new A()`,
        `## empty

**Signature**

\`\`\`ts
export declare const empty: A
\`\`\`

Since v1.0.0`
      )
    })

    it("should handle constants with typeof annotations", async () => {
      await expectMarkdown(
        Parser.parseConstants,
        ` const task: { a: number } = {
        a: 1
      }
      /**
      * @since 1.0.0
      */
      export const taskSeq: typeof task = {
        ...task,
        ap: (mab, ma) => () => mab().then(f => ma().then(a => f(a)))
      }`,
        `## taskSeq

**Signature**

\`\`\`ts
export declare const taskSeq: { a: number; }
\`\`\`

Since v1.0.0`
      )
    })

    it("should not include variables declared in for loops", async () => {
      await expectMarkdown(
        Parser.parseConstants,
        ` const object = { a: 1, b: 2, c: 3 };

      for (const property in object) {
        console.log(property);
      }`,
        ""
      )
    })
  })

  describe("parseTypeAliases", () => {
    it("should return a type alias", async () => {
      await expectMarkdown(
        Parser.parseTypeAliases,
        `/**
          * a description...
          * @since 1.0.0
          * @deprecated
          */
          export type Option<A> = None<A> | Some<A>`,
        `## ~~Option~~ (type alias)

a description...

**Signature**

\`\`\`ts
export type Option<A> = None<A> | Some<A>
\`\`\`

Since v1.0.0`
      )
    })
  })

  describe("parseExports", () => {
    it("should return no exports if the file is empty", async () => {
      await expectMarkdown(
        Parser.parseExports,
        "",
        ""
      )
    })

    it("should handle renamimg", async () => {
      await expectMarkdown(
        Parser.parseExports,
        `const a = 1;
        export {
          /**
            * @since 1.0.0
            */
            a as b
          }`,
        `## b

**Signature**

\`\`\`ts
export declare const b: 1
\`\`\`

Since v1.0.0`
      )
    })

    it("should return an `Export`", async () => {
      await expectMarkdown(
        Parser.parseExports,
        `
        const a = 1;
        const b = 2;
        export {
          /**
           * description_of_a
           * @since 1.0.0
           */
          a,
          /**
           * description_of_b
           * @since 2.0.0
           */
          b
        }`,
        `## a

description_of_a

**Signature**

\`\`\`ts
export declare const a: 1
\`\`\`

Since v1.0.0
## b

description_of_b

**Signature**

\`\`\`ts
export declare const b: 2
\`\`\`

Since v2.0.0`
      )
    })

    it("should raise an error if `@since` tag is missing in export", () => {
      expectFailure("export { a }", Parser.parseExports, [
        `Missing ${chalk.bold("a")} documentation in ${chalk.bold("test")}`
      ])
    })

    it("should handle a single re-export", () => {
      project.createSourceFile("a.ts", `export const a = 1`)
      const sourceFile = project.createSourceFile(
        "b.ts",
        `import { a } from './a'
        const b = a
        export {
          /**
            * @since 1.0.0
            */
          b
        }`
      )
      const actual = Parser.parseExports.pipe(
        Effect.provideService(Parser.Source, makeSourceFromSourceFile(sourceFile)),
        Effect.provideService(Configuration.Configuration, defaultConfig),
        Effect.runSyncExit
      )
      assert.deepStrictEqual(
        actual,
        Exit.succeed([
          new Domain.Export(
            "b",
            new Domain.Doc(
              undefined,
              "1.0.0",
              false,
              [],
              undefined
            ),
            "export declare const b: 1"
          )
        ])
      )
    })

    it("should handle `export * from ...`", () => {
      project.createSourceFile("example.ts", `export const a = 1`, { overwrite: true })

      const sourceFile = project.createSourceFile(
        "export-all.ts",
        `
         /**
          * @since 1.0.0
          */
         export * from './example'
        `
      )

      const actual = Parser.parseExports.pipe(
        Effect.provideService(Parser.Source, makeSourceFromSourceFile(sourceFile)),
        Effect.provideService(Configuration.Configuration, defaultConfig),
        Effect.runSyncExit
      )

      assert.deepStrictEqual(
        actual,
        Exit.succeed([
          new Domain.Export(
            "From './example'",
            new Domain.Doc(
              undefined,
              "1.0.0",
              false,
              [],
              undefined
            ),
            "export * from './example'"
          )
        ])
      )
    })

    it("should handle `export * as ... from ...`", () => {
      project.createSourceFile("example.ts", `export const a = 1`, { overwrite: true })

      const sourceFile = project.createSourceFile(
        "export-all-namespace.ts",
        `
          /**
           * @since 1.0.0
           */
          export * as example from './example'
        `
      )

      const actual = Parser.parseExports.pipe(
        Effect.provideService(Parser.Source, makeSourceFromSourceFile(sourceFile)),
        Effect.provideService(Configuration.Configuration, defaultConfig),
        Effect.runSyncExit
      )

      assert.deepStrictEqual(
        actual,
        Exit.succeed([
          new Domain.Export(
            "From './example'",
            new Domain.Doc(
              undefined,
              "1.0.0",
              false,
              [],
              undefined
            ),
            "export * as example from './example'"
          )
        ])
      )
    })
  })

  describe("parseInterfaces", () => {
    it("should return no interfaces if the file is empty", async () => {
      await expectMarkdown(
        Parser.parseInterfaces,
        "",
        ""
      )
    })

    it("should return no interfaces if there are no exported interfaces", async () => {
      await expectMarkdown(
        Parser.parseInterfaces,
        "interface A {}",
        ""
      )
    })

    it("should return an interface", async () => {
      await expectMarkdown(
        Parser.parseInterfaces,
        `/**
      * a description...
      * @since 1.0.0
      * @deprecated
      */
      export interface A {}`,
        `## ~~A~~ (interface)

a description...

**Signature**

\`\`\`ts
export interface A {}
\`\`\`

Since v1.0.0`
      )
    })

    it("should return interfaces sorted by name", async () => {
      await expectMarkdown(
        Parser.parseInterfaces,
        `
      /**
       * @since 1.0.0
       */
      export interface B {}
      /**
       * @since 1.0.0
       */
      export interface A {}
      `,
        `## A (interface)

**Signature**

\`\`\`ts
export interface A {}
\`\`\`

Since v1.0.0
## B (interface)

**Signature**

\`\`\`ts
export interface B {}
\`\`\`

Since v1.0.0`
      )
    })
  })

  describe("parseNamespaces", () => {
    it("should return no namespaces if the file is empty", async () => {
      await expectMarkdown(
        Parser.parseNamespaces,
        "",
        ""
      )
    })

    it("should return no namespaces if there are no exported namespaces", async () => {
      await expectMarkdown(
        Parser.parseNamespaces,
        "namespace A {}",
        ""
      )
    })

    it("should raise an error if the namespace is not well documented", () => {
      expectFailure("export namespace A {}", Parser.parseNamespaces, [
        `Missing ${chalk.bold("@since")} tag in ${chalk.bold("test#A")} documentation`
      ])
    })

    it("should parse an empty Namespace", async () => {
      await expectMarkdown(
        Parser.parseNamespaces,
        `
      /**
       * @since 1.0.0
       */
      export namespace A {}
      `,
        `## A (namespace)

Since v1.0.0`
      )
    })

    describe("namespace > interfaces", () => {
      it("should ignore not exported interfaces", async () => {
        await expectMarkdown(
          Parser.parseNamespaces,
          `
        /**
         * @since 1.0.0
         */
        export namespace A {
          interface C {}
        }
        `,
          `## A (namespace)

Since v1.0.0`
        )
      })

      it("should raise an error if the interface is not well documented", () => {
        expectFailure(
          `
        /**
         * @since 1.0.0
         */
        export namespace A {
          export interface B {}
        }
        `,
          Parser.parseNamespaces,
          [`Missing ${chalk.bold("@since")} tag in ${chalk.bold("test#B")} documentation`]
        )
      })

      it("should parse an interface", async () => {
        await expectMarkdown(
          Parser.parseNamespaces,
          `
/**
 * @since 1.0.0
 */
export namespace A {
  /**
   * @since 1.0.1
   */
  export interface B {
    readonly d: boolean
  }
}
        `,
          `## A (namespace)

Since v1.0.0

### B (interface)

**Signature**

\`\`\`ts
export interface B {
    readonly d: boolean
  }
\`\`\`

Since v1.0.1`
        )
      })
    })

    describe("namespace > type aliases", () => {
      it("should ignore not exported type aliases", async () => {
        await expectMarkdown(
          Parser.parseNamespaces,
          `
        /**
         * @since 1.0.0
         */
        export namespace A {
          type C = number
        }
        `,
          `## A (namespace)

Since v1.0.0`
        )
      })

      it("should raise an error if the type alias is not well documented", () => {
        expectFailure(
          `
        /**
         * @since 1.0.0
         */
        export namespace A {
          export type B = string
        }
        `,
          Parser.parseNamespaces,
          [`Missing ${chalk.bold("@since")} tag in ${chalk.bold("test#B")} documentation`]
        )
      })

      it("should parse a type alias", async () => {
        await expectMarkdown(
          Parser.parseNamespaces,
          `
        /**
         * @since 1.0.0
         */
        export namespace A {
          /**
           * @since 1.0.1
           */
          export type B = string
        }
        `,
          `## A (namespace)

Since v1.0.0

### B (type alias)

**Signature**

\`\`\`ts
export type B = string
\`\`\`

Since v1.0.1`
        )
      })
    })

    describe("namespace > nested namespaces", () => {
      it("should ignore not exported namespaces", async () => {
        await expectMarkdown(
          Parser.parseNamespaces,
          `
        /**
         * @since 1.0.0
         */
        export namespace A {
          namespace B {}
        }
        `,
          `## A (namespace)

Since v1.0.0`
        )
      })

      it("should raise an error if the namespace is not well documented", () => {
        expectFailure(
          `
        /**
         * @since 1.0.0
         */
        export namespace A {
          export namespace B {}
        }
        `,
          Parser.parseNamespaces,
          [`Missing ${chalk.bold("@since")} tag in ${chalk.bold("test#B")} documentation`]
        )
      })

      it("should parse a namespace", async () => {
        await expectMarkdown(
          Parser.parseNamespaces,
          `
        /**
         * @since 1.0.0
         */
        export namespace A {
          /**
           * @since 1.0.1
           */
          export namespace B {
            /**
             * @since 1.0.2
             */
            export type C = string
          }
        }
        `,
          `## A (namespace)

Since v1.0.0

### B (namespace)

Since v1.0.1

#### C (type alias)

**Signature**

\`\`\`ts
export type C = string
\`\`\`

Since v1.0.2`
        )
      })
    })
  })

  describe("parseClasses", () => {
    it("should raise an error if the class is anonymous", () => {
      expectFailure(`export class {}`, Parser.parseClasses, [
        `Missing ${chalk.bold("class name")} in module ${chalk.bold("test")}`
      ])
    })

    it("should raise an error if an `@since` tag is missing in a module", () => {
      expectFailure(`export class MyClass {}`, Parser.parseClasses, [
        `Missing ${chalk.bold("@since")} tag in ${chalk.bold("test#MyClass")} documentation`
      ])
    })

    it("should ignore internal classes", async () => {
      await expectMarkdown(
        Parser.parseClasses,
        `/** @internal */export class MyClass {}`,
        ""
      )
    })

    it("should ignore `@ignore`d classes", async () => {
      await expectMarkdown(
        Parser.parseClasses,
        `
        /** @ignore */
        export class MyClass {}
        `,
        ""
      )
    })

    it("should raise an error if `@since` is missing in a property", () => {
      expectFailure(
        `/**
          * @since 1.0.0
          */
          export class MyClass<A> {
            readonly _A!: A
          }`,
        Parser.parseClasses,
        [`Missing ${chalk.bold("@since")} tag in ${chalk.bold("test#MyClass#_A")} documentation`]
      )
    })

    it("should skip ignored properties", async () => {
      await expectMarkdown(
        Parser.parseClasses,
        `/**
      * @since 1.0.0
      */
      export class MyClass<A> {
        /**
         * @ignore
         */
        readonly _A!: A
      }`,
        `## MyClass (class)

**Signature**

\`\`\`ts
export declare class MyClass<A>
\`\`\`

Since v1.0.0`
      )
    })

    it("should skip the constructor body", async () => {
      await expectMarkdown(
        Parser.parseClasses,
        `/**
      * description
      * @since 1.0.0
      */
      export class C { constructor() {} }`,
        `## C (class)

description

**Signature**

\`\`\`ts
export declare class C { constructor() }
\`\`\`

Since v1.0.0`
      )
    })

    it("should get a constructor declaration signature", () => {
      const sourceFile = project.createSourceFile(
        `test-${testCounter++}.ts`,
        `
      /**
       * @since 1.0.0
       */
      declare class A {
        constructor()
      }
    `
      )

      const constructorDeclaration = sourceFile
        .getClass("A")!
        .getConstructors()[0]

      assert.deepStrictEqual(
        Parser.getConstructorDeclarationSignature(constructorDeclaration),
        "constructor()"
      )
    })

    it("should handle non-readonly properties", async () => {
      await expectMarkdown(
        Parser.parseClasses,
        `/**
      * description
      * @since 1.0.0
      */
      export class C {
        /**
         * @since 1.0.0
         */
        a: string
      }`,
        `## C (class)

description

**Signature**

\`\`\`ts
export declare class C
\`\`\`

Since v1.0.0

### a (property)

**Signature**

\`\`\`ts
a: string
\`\`\`

Since v1.0.0`
      )
    })

    it("should return a `Class`", async () => {
      await expectMarkdown(
        Parser.parseClasses,
        `/**
      * a class description...
      * @since 1.0.0
      * @deprecated
      */
      export class Test {
        /**
         * a property...
         * @since 1.1.0
         * @deprecated
         */
        readonly a: string
        private readonly b: number
        /**
         * a static method description...
         * @since 1.1.0
         * @deprecated
         */
        static f(): void {}
        constructor(readonly value: string) { }
        /**
         * a method description...
         * @since 1.1.0
         * @deprecated
         */
        g(a: number, b: number): { [key: string]: number } {
          return { a, b }
        }
      }`,
        `## ~~Test~~ (class)

a class description...

**Signature**

\`\`\`ts
export declare class Test { constructor(readonly value: string) }
\`\`\`

Since v1.0.0

### ~~f~~ (static method)

a static method description...

**Signature**

\`\`\`ts
static f(): void
\`\`\`

Since v1.1.0

### ~~g~~ (method)

a method description...

**Signature**

\`\`\`ts
g(a: number, b: number): { [key: string]: number }
\`\`\`

Since v1.1.0

### ~~a~~ (property)

a property...

**Signature**

\`\`\`ts
readonly a: string
\`\`\`

Since v1.1.0`
      )
    })

    it("should handle method overloadings", async () => {
      await expectMarkdown(
        Parser.parseClasses,
        `/**
      * a class description...
      * @since 1.0.0
      * @deprecated
      */
      export class Test<A> {
        /**
         * a static method description...
         * @since 1.1.0
         * @deprecated
         */
        static f(x: number): number
        static f(x: string): string
        static f(x: any): any {}
        constructor(readonly value: A) { }
        /**
         * a method description...
         * @since 1.1.0
         * @deprecated
         */
        map(f: (a: number) => number): Test
        map(f: (a: string) => string): Test
        map(f: (a: any) => any): any {
          return new Test(f(this.value))
        }
      }`,
        `## ~~Test~~ (class)

a class description...

**Signature**

\`\`\`ts
export declare class Test<A> { constructor(readonly value: A) }
\`\`\`

Since v1.0.0

### ~~f~~ (static method)

a static method description...

**Signature**

\`\`\`ts
static f(x: number): number
static f(x: string): string
\`\`\`

Since v1.1.0

### ~~map~~ (method)

a method description...

**Signature**

\`\`\`ts
map(f: (a: number) => number): Test
map(f: (a: string) => string): Test
\`\`\`

Since v1.1.0`
      )
    })

    it("should ignore internal/ignored methods (#42)", async () => {
      await expectMarkdown(
        Parser.parseClasses,
        `/**
      * a class description...
      * @since 1.0.0
      */
      export class Test<A> {
        /**
         * @since 0.0.1
         * @internal
         **/
        private foo(): void {}
        /**
         * @since 0.0.1
         * @ignore
         **/
        private bar(): void {}
      }`,
        `## Test (class)

a class description...

**Signature**

\`\`\`ts
export declare class Test<A>
\`\`\`

Since v1.0.0`
      )
    })
  })

  describe("parseFile", () => {
    it("should not parse a non-existent file", async () => {
      const file = new Domain.File("non-existent.ts", "")
      const project = new ast.Project({ useInMemoryFileSystem: true })

      assert.deepStrictEqual(
        Parser.parseFile(project)(file).pipe(
          Effect.provideService(Configuration.Configuration, defaultConfig),
          Effect.provide(Path.layer),
          Effect.runSyncExit
        ),
        Exit.fail(["Unable to locate file: non-existent.ts"])
      )
    })
  })

  describe("utils", () => {
    describe("getDoc", () => {
      it("should parse comment information", () => {
        const text = `/**
         * description
         * @category instances
         * @since 1.0.0
         */`
        expectSuccess(
          "",
          Parser.getDoc("name", text),
          new Domain.Doc(
            "description",
            "1.0.0",
            false,
            [],
            "instances"
          )
        )
      })

      it("should fail if an empty comment tag is provided", () => {
        const text = `/**
         * @category
         * @since 1.0.0
         */`
        expectFailure(
          "",
          Parser.getDoc("name", text),
          `Missing ${chalk.bold("@category")} tag in ${chalk.bold("test#name")} documentation`
        )
      })

      it("should require a description if `enforceDescriptions` is set to true", () => {
        const text = `/**
         * @category instances
         * @since 1.0.0
         */`
        expectFailure(
          "",
          Parser.getDoc("name", text),
          `Missing ${chalk.bold("description")} in ${chalk.bold("test#name")} documentation`,
          {
            enforceDescriptions: true
          }
        )
      })

      it("should require at least one example if `enforceExamples` is set to true", () => {
        const text = `/**
         * description
         * @category instances
         * @since 1.0.0
         */`
        expectFailure(
          "",
          Parser.getDoc("name", text),
          `Missing ${chalk.bold("@example")} tag in ${chalk.bold("test#name")} documentation`,
          {
            enforceExamples: true
          }
        )
      })

      it("should require at least one non-empty example if `enforceExamples` is set to true", () => {
        const text = `/**
         * description
         * @example
         * @category instances
         * @since 1.0.0
         */`
        expectFailure(
          "",
          Parser.getDoc("name", text),
          `Missing ${chalk.bold("@example")} tag in ${chalk.bold("test#name")} documentation`,
          {
            enforceExamples: true
          }
        )
      })

      it("should allow no since tag if `enforceVersion` is set to false", () => {
        const text = `/**
* description
* @category instances
*/`

        expectSuccess(
          "",
          Parser.getDoc("name", text),
          new Domain.Doc(
            "description",
            undefined,
            false,
            [],
            "instances"
          ),
          { enforceVersion: false }
        )
      })
    })

    it("parseComment", () => {
      assert.deepStrictEqual(Parser.parseComment(""), {
        description: undefined,
        tags: {}
      })

      assert.deepStrictEqual(Parser.parseComment("/** description */"), {
        description: "description",
        tags: {}
      })

      assert.deepStrictEqual(
        Parser.parseComment("/** description\n * @since 1.0.0\n */"),
        {
          description: "description",
          tags: {
            since: ["1.0.0"]
          }
        }
      )

      assert.deepStrictEqual(
        Parser.parseComment("/** description\n * @deprecated\n */"),
        {
          description: "description",
          tags: {
            deprecated: [undefined]
          }
        }
      )

      assert.deepStrictEqual(
        Parser.parseComment("/** description\n * @category instance\n */"),
        {
          description: "description",
          tags: {
            category: ["instance"]
          }
        }
      )
    })

    it("stripImportTypes", () => {
      assert.deepStrictEqual(
        Parser.stripImportTypes(
          "{ <E, A, B>(refinement: import(\"/Users/giulio/Documents/Projects/github/fp-ts/src/function\").Refinement<A, B>, onFalse: (a: A) => E): (ma: Either<E, A>) => Either<E, B>; <E, A>(predicate: Predicate<A>, onFalse: (a: A) => E): (ma: Either<E, A>) => Either<E, A>; }"
        ),
        "{ <E, A, B>(refinement: Refinement<A, B>, onFalse: (a: A) => E): (ma: Either<E, A>) => Either<E, B>; <E, A>(predicate: Predicate<A>, onFalse: (a: A) => E): (ma: Either<E, A>) => Either<E, A>; }"
      )
      assert.deepStrictEqual(
        Parser.stripImportTypes(
          "{ <A, B>(refinementWithIndex: import(\"/Users/giulio/Documents/Projects/github/fp-ts/src/FilterableWithIndex\").RefinementWithIndex<number, A, B>): (fa: A[]) => B[]; <A>(predicateWithIndex: import(\"/Users/giulio/Documents/Projects/github/fp-ts/src/FilterableWithIndex\").PredicateWithIndex<number, A>): (fa: A[]) => A[]; }"
        ),
        "{ <A, B>(refinementWithIndex: RefinementWithIndex<number, A, B>): (fa: A[]) => B[]; <A>(predicateWithIndex: PredicateWithIndex<number, A>): (fa: A[]) => A[]; }"
      )
    })
  })
})

describe("Parser-old", () => {
  describe("parseModuleDocumentation", () => {
    it("should return a description field and a deprecated field", () => {
      expectSuccess(
        `/**
            * Manages the configuration settings for the widget
            * @deprecated
            * @since 1.0.0
            */
            /**
             * @since 1.2.0
             */
            export const a: number = 1`,
        Parser.parseModuleDocumentation,
        new Domain.Doc(
          "Manages the configuration settings for the widget",
          "1.0.0",
          true,
          [],
          undefined
        ),
        { enforceVersion: true }
      )
    })

    it("should support absence of module documentation when no documentation is enforced", () => {
      expectSuccess(
        "export const a: number = 1",
        Parser.parseModuleDocumentation,
        new Domain.Doc(
          undefined,
          undefined,
          false,
          [],
          undefined
        ),
        { enforceVersion: false }
      )
    })

    it("should return an error when documentation is enforced but no documentation is provided", () => {
      expectFailure(
        "export const a: number = 1",
        Parser.parseModuleDocumentation,
        [`Missing ${chalk.bold("documentation")} in ${chalk.bold("test")} module`]
      )
    })
  })

  describe("parseModule", () => {
    it("should raise an error if `@since` tag is missing", async () => {
      expectFailure(`import * as assert from 'assert'`, Parser.parseModule, [
        `Missing ${chalk.bold("documentation")} in ${chalk.bold("test")} module`
      ])
    })

    it("should not require an example for modules when `enforceExamples` is set to true", async () => {
      await expectMarkdown(
        Parser.parseModule,
        `/**
* This is the assert module.
*
* @since 1.0.0
*/
import * as assert from 'assert'

/**
 * This is the foo export.
 *
 * @example
 * import { foo } from 'test'
 *
 * console.log(foo)
 *
 * @category foo
 * @since 1.0.0
 */
export const foo = 'foo'`,
        `## test overview

This is the assert module.

Since v1.0.0
# foo
## foo

This is the foo export.

**Example**

\`\`\`ts
import { foo } from 'test'

console.log(foo)
\`\`\`

**Signature**

\`\`\`ts
export declare const foo: "foo"
\`\`\`

Since v1.0.0`
      )
    })
  })
})
