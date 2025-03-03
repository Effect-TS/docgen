import * as Configuration from "@effect/docgen/Configuration"
import * as Domain from "@effect/docgen/Domain"
import * as File from "@effect/docgen/File"
import * as Parser from "@effect/docgen/Parser"
import { Path } from "@effect/platform"
import chalk from "chalk"
import { Effect, Exit, Option, String } from "effect"
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
  runExamples: true,
  exclude: [],
  parseCompilerOptions: {},
  examplesCompilerOptions: {}
}

const getParser = (sourceText: string): Parser.SourceShape => ({
  path: ["test"],
  sourceFile: project.createSourceFile(`test-${testCounter++}.ts`, sourceText)
})

const expectFailure = <A, E>(
  sourceText: string,
  eff: Effect.Effect<A, E, Parser.Source | Configuration.Configuration | Path.Path>,
  failure: E,
  config?: Partial<Configuration.ConfigurationShape>
) => {
  assert.deepStrictEqual(
    eff.pipe(
      Effect.provideService(Parser.Source, getParser(sourceText)),
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
  a: A,
  config?: Partial<Configuration.ConfigurationShape>
) => {
  assert.deepStrictEqual(
    eff
      .pipe(
        Effect.provideService(Parser.Source, getParser(sourceText)),
        Effect.provideService(Configuration.Configuration, { ...defaultConfig, ...config }),
        Effect.provide(Path.layer),
        Effect.runSyncExit
      ),
    Exit.succeed(a)
  )
}

describe("Parser", () => {
  describe("parsers", () => {
    describe("parseNamespaces", () => {
      it("should return no `Namespaces`s if the file is empty", () => {
        expectSuccess("", Parser.parseNamespaces, [])
      })

      it("should return no `Namespaces`s if there are no exported namespaces", () => {
        expectSuccess("namespace A {}", Parser.parseNamespaces, [])
      })

      it("should raise an error if the namespace is not well documented", () => {
        expectFailure("export namespace A {}", Parser.parseNamespaces, [
          `Missing ${chalk.bold("@since")} tag in ${chalk.bold("test#A")} documentation`
        ])
      })

      const documentableA = new Domain.NamedDoc(
        "A",
        Option.none(),
        Option.some("1.0.0"),
        false,
        [],
        Option.none()
      )

      it("should parse an empty Namespace", () => {
        expectSuccess(
          `
        /**
         * @since 1.0.0
         */
        export namespace A {}
        `,
          Parser.parseNamespaces,
          [
            new Domain.Namespace(documentableA, [], [], [])
          ]
        )
      })

      describe("interfaces", () => {
        it("should ignore not exported interfaces", () => {
          expectSuccess(
            `
          /**
           * @since 1.0.0
           */
          export namespace A {
            interface C {}
          }
          `,
            Parser.parseNamespaces,
            [new Domain.Namespace(documentableA, [], [], [])]
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

        it("should parse an interface", () => {
          const documentableB = new Domain.NamedDoc(
            "B",
            Option.none(),
            Option.some("1.0.1"),
            false,
            [],
            Option.none()
          )

          expectSuccess(
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
            Parser.parseNamespaces,
            [
              new Domain.Namespace(
                documentableA,
                [
                  new Domain.Interface(
                    documentableB,
                    `export interface B {
              readonly d: boolean
            }`
                  )
                ],
                [],
                []
              )
            ]
          )
        })
      })

      describe("type aliases", () => {
        it("should ignore not exported type alias", () => {
          expectSuccess(
            `
          /**
           * @since 1.0.0
           */
          export namespace A {
            type C = number
          }
          `,
            Parser.parseNamespaces,
            [new Domain.Namespace(documentableA, [], [], [])]
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

        it("should parse a type alias", () => {
          const documentableB = new Domain.NamedDoc(
            "B",
            Option.none(),
            Option.some("1.0.1"),
            false,
            [],
            Option.none()
          )

          expectSuccess(
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
            Parser.parseNamespaces,
            [
              new Domain.Namespace(documentableA, [], [
                new Domain.TypeAlias(documentableB, "export type B = string")
              ], [])
            ]
          )
        })
      })

      describe("nested namespaces", () => {
        it("should ignore not exported namespaces", () => {
          expectSuccess(
            `
          /**
           * @since 1.0.0
           */
          export namespace A {
            namespace B {}
          }
          `,
            Parser.parseNamespaces,
            [new Domain.Namespace(documentableA, [], [], [])]
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

        it("should parse a namespace", () => {
          const documentableB = new Domain.NamedDoc(
            "B",
            Option.none(),
            Option.some("1.0.1"),
            false,
            [],
            Option.none()
          )
          const documentableC = new Domain.NamedDoc(
            "C",
            Option.none(),
            Option.some("1.0.2"),
            false,
            [],
            Option.none()
          )

          expectSuccess(
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
            Parser.parseNamespaces,
            [
              new Domain.Namespace(documentableA, [], [], [
                new Domain.Namespace(documentableB, [], [
                  new Domain.TypeAlias(documentableC, "export type C = string")
                ], [])
              ])
            ]
          )
        })
      })
    })

    describe("parseInterfaces", () => {
      it("should return no `Interface`s if the file is empty", () => {
        expectSuccess("", Parser.parseInterfaces, [])
      })

      it("should return no `Interface`s if there are no exported interfaces", () => {
        expectSuccess("interface A {}", Parser.parseInterfaces, [])
      })

      it("should return an `Interface`", () => {
        expectSuccess(
          `/**
        * a description...
        * @since 1.0.0
        * @deprecated
        */
        export interface A {}`,
          Parser.parseInterfaces,
          [
            new Domain.Interface(
              new Domain.NamedDoc(
                "A",
                Option.some("a description..."),
                Option.some("1.0.0"),
                true,
                [],
                Option.none()
              ),
              "export interface A {}"
            )
          ]
        )
      })

      it("should return interfaces sorted by name", () => {
        expectSuccess(
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
          Parser.parseInterfaces,
          [
            new Domain.Interface(
              new Domain.NamedDoc(
                "A",
                Option.none(),
                Option.some("1.0.0"),
                false,
                [],
                Option.none()
              ),
              "export interface A {}"
            ),
            new Domain.Interface(
              new Domain.NamedDoc(
                "B",
                Option.none(),
                Option.some("1.0.0"),
                false,
                [],
                Option.none()
              ),
              "export interface B {}"
            )
          ]
        )
      })
    })

    describe("parseFunctions", () => {
      it("should raise an error if the function is anonymous", () => {
        expectFailure(
          `export function(a: number, b: number): number { return a + b }`,
          Parser.parseFunctions,
          [`Missing ${chalk.bold("function name")} in module ${chalk.bold("test")}`]
        )
      })

      it("should not return private function declarations", () => {
        expectSuccess(
          `function sum(a: number, b: number): number { return a + b }`,
          Parser.parseFunctions,
          []
        )
      })

      it("should not return ignored function declarations", () => {
        expectSuccess(
          `/**
        * @ignore
        */
        export function sum(a: number, b: number): number { return a + b }`,
          Parser.parseFunctions,
          []
        )
      })

      it("should not return ignored function declarations with overloads", () => {
        expectSuccess(
          `/**
            * @ignore
            */
            export function sum(a: number, b: number)
            export function sum(a: number, b: number): number { return a + b }`,
          Parser.parseFunctions,
          []
        )
      })

      it("should not return internal function declarations", () => {
        expectSuccess(
          `/**
            * @internal
            */
            export function sum(a: number, b: number): number { return a + b }`,
          Parser.parseFunctions,
          []
        )
      })

      it("should not return internal function declarations even with overloads", () => {
        expectSuccess(
          `/**
            * @internal
            */
            export function sum(a: number, b: number)
            export function sum(a: number, b: number): number { return a + b }`,
          Parser.parseFunctions,
          []
        )
      })

      it("should not return private const function declarations", () => {
        expectSuccess(
          `const sum = (a: number, b: number): number => a + b `,
          Parser.parseFunctions,
          []
        )
      })

      it("should not return internal const function declarations", () => {
        expectSuccess(
          `/**
            * @internal
            */
            export const sum = (a: number, b: number): number => a + b `,
          Parser.parseFunctions,
          []
        )
      })

      it("should account for nullable polymorphic return types", () => {
        expectSuccess(
          `/**
            * @since 1.0.0
            */
           export const toNullable = <A>(ma: A | null): A | null => ma`,
          Parser.parseFunctions,
          [
            new Domain.Function(
              new Domain.NamedDoc(
                "toNullable",
                Option.none(),
                Option.some("1.0.0"),
                false,
                [],
                Option.none()
              ),
              [
                "export declare const toNullable: <A>(ma: A | null) => A | null"
              ],
              []
            )
          ]
        )
      })

      it("should return a const function declaration", () => {
        expectSuccess(
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
          Parser.parseFunctions,
          [
            new Domain.Function(
              new Domain.NamedDoc(
                "f",
                Option.some("a description..."),
                Option.some("1.0.0"),
                true,
                [
                  new Domain.Example("assert.deepStrictEqual(f(1, 2), { a: 1, b: 2 })"),
                  new Domain.Example("assert.deepStrictEqual(f(3, 4), { a: 3, b: 4 })")
                ],
                Option.none()
              ),
              [
                "export declare const f: (a: number, b: number) => { [key: string]: number; }"
              ],
              []
            )
          ]
        )
      })

      it("should parse examples even when enclosed in code blocks using backticks", () => {
        expectSuccess(
          `/**
            * a description...
            * @since 1.0.0
            * @example
            * \`\`\`ts
            * assert.deepStrictEqual(f(1, 2), { a: 1, b: 2 })
            * \`\`\`
            * @example
            * assert.deepStrictEqual(f(3, 4), { a: 3, b: 4 })
            * @deprecated
            */
            export const f = (a: number, b: number): { [key: string]: number } => ({ a, b })`,
          Parser.parseFunctions,
          [
            new Domain.Function(
              new Domain.NamedDoc(
                "f",
                Option.some("a description..."),
                Option.some("1.0.0"),
                true,
                [
                  new Domain.Example(`\`\`\`ts
assert.deepStrictEqual(f(1, 2), { a: 1, b: 2 })
\`\`\``),
                  new Domain.Example("assert.deepStrictEqual(f(3, 4), { a: 3, b: 4 })")
                ],
                Option.none()
              ),
              [
                "export declare const f: (a: number, b: number) => { [key: string]: number; }"
              ],
              []
            )
          ]
        )
      })

      it("should parse multiline examples even when enclosed in code blocks using backticks", () => {
        expectSuccess(
          `/**
            * a description...
            * @since 1.0.0
            * @example
            * \`\`\`ts
            * assert.deepStrictEqual(f(1, 2), { a: 1, b: 2 })
            *
            * assert.deepStrictEqual(f(3, 4), { a: 3, b: 4 })
            * \`\`\`
            * @deprecated
            */
            export const f = (a: number, b: number): { [key: string]: number } => ({ a, b })`,
          Parser.parseFunctions,
          [
            new Domain.Function(
              new Domain.NamedDoc(
                "f",
                Option.some("a description..."),
                Option.some("1.0.0"),
                true,
                [
                  new Domain.Example(`\`\`\`ts
assert.deepStrictEqual(f(1, 2), { a: 1, b: 2 })

assert.deepStrictEqual(f(3, 4), { a: 3, b: 4 })
\`\`\``)
                ],
                Option.none()
              ),
              [
                "export declare const f: (a: number, b: number) => { [key: string]: number; }"
              ],
              []
            )
          ]
        )
      })

      it("should parse examples even when enclosed in code blocks using tildes", () => {
        expectSuccess(
          `/**
            * a description...
            * @since 1.0.0
            * @example
            * ~~~ts
            * assert.deepStrictEqual(f(1, 2), { a: 1, b: 2 })
            * ~~~
            * @example
            * assert.deepStrictEqual(f(3, 4), { a: 3, b: 4 })
            * @deprecated
            */
            export const f = (a: number, b: number): { [key: string]: number } => ({ a, b })`,
          Parser.parseFunctions,
          [
            new Domain.Function(
              new Domain.NamedDoc(
                "f",
                Option.some("a description..."),
                Option.some("1.0.0"),
                true,
                [
                  new Domain.Example(`~~~ts
assert.deepStrictEqual(f(1, 2), { a: 1, b: 2 })
~~~`),
                  new Domain.Example("assert.deepStrictEqual(f(3, 4), { a: 3, b: 4 })")
                ],
                Option.none()
              ),
              [
                "export declare const f: (a: number, b: number) => { [key: string]: number; }"
              ],
              []
            )
          ]
        )
      })

      it("should parse multiline examples even when enclosed in code blocks using backticks", () => {
        expectSuccess(
          `/**
            * a description...
            * @since 1.0.0
            * @example
            * ~~~ts
            * assert.deepStrictEqual(f(1, 2), { a: 1, b: 2 })
            *
            * assert.deepStrictEqual(f(3, 4), { a: 3, b: 4 })
            * ~~~
            * @deprecated
            */
            export const f = (a: number, b: number): { [key: string]: number } => ({ a, b })`,
          Parser.parseFunctions,
          [
            new Domain.Function(
              new Domain.NamedDoc(
                "f",
                Option.some("a description..."),
                Option.some("1.0.0"),
                true,
                [
                  new Domain.Example(`~~~ts
assert.deepStrictEqual(f(1, 2), { a: 1, b: 2 })

assert.deepStrictEqual(f(3, 4), { a: 3, b: 4 })
~~~`)
                ],
                Option.none()
              ),
              [
                "export declare const f: (a: number, b: number) => { [key: string]: number; }"
              ],
              []
            )
          ]
        )
      })

      it("should  parse twoslash examples using backtick fences", () => {
        expectSuccess(
          `/**
            * a description...
            * @since 1.0.0
            * @example
            * \`\`\`ts twoslash
            * assert.deepStrictEqual(f(1, 2), { a: 1, b: 2 })
            * \`\`\`
            * @example
            * assert.deepStrictEqual(f(3, 4), { a: 3, b: 4 })
            * @deprecated
            */
            export const f = (a: number, b: number): { [key: string]: number } => ({ a, b })`,
          Parser.parseFunctions,
          [
            new Domain.Function(
              new Domain.NamedDoc(
                "f",
                Option.some("a description..."),
                Option.some("1.0.0"),
                true,
                [
                  new Domain.Example(`\`\`\`ts twoslash
assert.deepStrictEqual(f(1, 2), { a: 1, b: 2 })
\`\`\``),
                  new Domain.Example(`assert.deepStrictEqual(f(3, 4), { a: 3, b: 4 })`)
                ],
                Option.none()
              ),
              [
                "export declare const f: (a: number, b: number) => { [key: string]: number; }"
              ],
              []
            )
          ]
        )
      })

      it("should  parse twoslash examples using tilde fences", () => {
        expectSuccess(
          `/**
            * a description...
            * @since 1.0.0
            * @example
            * ~~~ts twoslash
            * assert.deepStrictEqual(f(1, 2), { a: 1, b: 2 })
            * ~~~
            * @example
            * assert.deepStrictEqual(f(3, 4), { a: 3, b: 4 })
            * @deprecated
            */
            export const f = (a: number, b: number): { [key: string]: number } => ({ a, b })`,
          Parser.parseFunctions,
          [
            new Domain.Function(
              new Domain.NamedDoc(
                "f",
                Option.some("a description..."),
                Option.some("1.0.0"),
                true,
                [
                  new Domain.Example(`~~~ts twoslash
assert.deepStrictEqual(f(1, 2), { a: 1, b: 2 })
~~~`),
                  new Domain.Example(`assert.deepStrictEqual(f(3, 4), { a: 3, b: 4 })`)
                ],
                Option.none()
              ),
              [
                "export declare const f: (a: number, b: number) => { [key: string]: number; }"
              ],
              []
            )
          ]
        )
      })

      it("should return a function declaration", () => {
        expectSuccess(
          `/**
            * @since 1.0.0
            */
            export function f(a: number, b: number): { [key: string]: number } { return { a, b } }`,
          Parser.parseFunctions,
          [
            new Domain.Function(
              new Domain.NamedDoc(
                "f",
                Option.none(),
                Option.some("1.0.0"),
                false,
                [],
                Option.none()
              ),
              [
                "export declare function f(a: number, b: number): { [key: string]: number }"
              ],
              []
            )
          ]
        )
      })

      it("should return a function with comments", () => {
        expectSuccess(
          `/**
            * a description...
            * @since 1.0.0
            * @deprecated
            */
            export function f(a: number, b: number): { [key: string]: number } { return { a, b } }`,
          Parser.parseFunctions,
          [
            new Domain.Function(
              new Domain.NamedDoc(
                "f",
                Option.some("a description..."),
                Option.some("1.0.0"),
                true,
                [],
                Option.none()
              ),
              [
                "export declare function f(a: number, b: number): { [key: string]: number }"
              ],
              []
            )
          ]
        )
      })

      it("should handle overloadings", () => {
        expectSuccess(
          `/**
            * a description...
            * @since 1.0.0
            * @deprecated
            */
            export function f(a: Int, b: Int): { [key: string]: number }
            export function f(a: number, b: number): { [key: string]: number }
            export function f(a: any, b: any): { [key: string]: number } { return { a, b } }`,
          Parser.parseFunctions,
          [
            new Domain.Function(
              new Domain.NamedDoc(
                "f",
                Option.some("a description..."),
                Option.some("1.0.0"),
                true,
                [],
                Option.none()
              ),
              [
                "export declare function f(a: Int, b: Int): { [key: string]: number }",
                "export declare function f(a: number, b: number): { [key: string]: number }"
              ],
              []
            )
          ]
        )
      })
    })

    describe("parseTypeAlias", () => {
      it("should return a `TypeAlias`", () => {
        expectSuccess(
          `/**
            * a description...
            * @since 1.0.0
            * @deprecated
            */
            export type Option<A> = None<A> | Some<A>`,
          Parser.parseTypeAliases,
          [
            new Domain.TypeAlias(
              new Domain.NamedDoc(
                "Option",
                Option.some("a description..."),
                Option.some("1.0.0"),
                true,
                [],
                Option.none()
              ),
              "export type Option<A> = None<A> | Some<A>"
            )
          ]
        )
      })
    })

    describe("parseConstants", () => {
      it("should handle a constant value", () => {
        expectSuccess(
          `/**
            * a description...
            * @since 1.0.0
            * @deprecated
            */
            export const s: string = ''`,
          Parser.parseConstants,
          [
            new Domain.Constant(
              new Domain.NamedDoc(
                "s",
                Option.some("a description..."),
                Option.some("1.0.0"),
                true,
                [],
                Option.none()
              ),
              "export declare const s: string"
            )
          ]
        )
      })

      it("should support constants with default type parameters", () => {
        expectSuccess(
          `/**
            * @since 1.0.0
            */
            export const left: <E = never, A = never>(l: E) => string = T.left`,
          Parser.parseConstants,
          [
            new Domain.Constant(
              new Domain.NamedDoc(
                "left",
                Option.none(),
                Option.some("1.0.0"),
                false,
                [],
                Option.none()
              ),
              "export declare const left: <E = never, A = never>(l: E) => string"
            )
          ]
        )
      })

      it("should support untyped constants", () => {
        expectSuccess(
          `
        class A {}
      /**
        * @since 1.0.0
        */
        export const empty = new A()`,
          Parser.parseConstants,
          [
            new Domain.Constant(
              new Domain.NamedDoc(
                "empty",
                Option.none(),
                Option.some("1.0.0"),
                false,
                [],
                Option.none()
              ),
              "export declare const empty: A"
            )
          ]
        )
      })

      it("should handle constants with typeof annotations", () => {
        expectSuccess(
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
          Parser.parseConstants,
          [
            new Domain.Constant(
              new Domain.NamedDoc(
                "taskSeq",
                Option.none(),
                Option.some("1.0.0"),
                false,
                [],
                Option.none()
              ),
              "export declare const taskSeq: { a: number; }"
            )
          ]
        )
      })

      it("should not include variables declared in for loops", () => {
        expectSuccess(
          ` const object = { a: 1, b: 2, c: 3 };

        for (const property in object) {
          console.log(property);
        }`,
          Parser.parseConstants,
          []
        )
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

      it("should ignore internal classes", () => {
        expectSuccess(`/** @internal */export class MyClass {}`, Parser.parseClasses, [])
      })

      it("should ignore `@ignore`d classes", () => {
        expectSuccess(`/** @ignore */export class MyClass {}`, Parser.parseClasses, [])
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

      it("should skip ignored properties", () => {
        expectSuccess(
          `/**
        * @since 1.0.0
        */
        export class MyClass<A> {
          /**
           * @ignore
           */
          readonly _A!: A
        }`,
          Parser.parseClasses,
          [
            new Domain.Class(
              new Domain.NamedDoc(
                "MyClass",
                Option.none(),
                Option.some("1.0.0"),
                false,
                [],
                Option.none()
              ),
              "export declare class MyClass<A>",
              [],
              [],
              []
            )
          ]
        )
      })

      it("should skip the constructor body", () => {
        expectSuccess(
          `/**
        * description
        * @since 1.0.0
        */
        export class C { constructor() {} }`,
          Parser.parseClasses,
          [
            new Domain.Class(
              new Domain.NamedDoc(
                "C",
                Option.some("description"),
                Option.some("1.0.0"),
                false,
                [],
                Option.none()
              ),
              "export declare class C { constructor() }",
              [],
              [],
              []
            )
          ]
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

      it("should handle non-readonly properties", () => {
        expectSuccess(
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
          Parser.parseClasses,
          [
            new Domain.Class(
              new Domain.NamedDoc(
                "C",
                Option.some("description"),
                Option.some("1.0.0"),
                false,
                [],
                Option.none()
              ),
              "export declare class C",
              [],
              [],
              [
                new Domain.Property(
                  new Domain.NamedDoc(
                    "a",
                    Option.none(),
                    Option.some("1.0.0"),
                    false,
                    [],
                    Option.none()
                  ),
                  "a: string"
                )
              ]
            )
          ]
        )
      })

      it("should return a `Class`", () => {
        expectSuccess(
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
          Parser.parseClasses,
          [
            new Domain.Class(
              new Domain.NamedDoc(
                "Test",
                Option.some("a class description..."),
                Option.some("1.0.0"),
                true,
                [],
                Option.none()
              ),
              "export declare class Test { constructor(readonly value: string) }",
              [
                new Domain.Method(
                  new Domain.NamedDoc(
                    "g",
                    Option.some("a method description..."),
                    Option.some("1.1.0"),
                    true,
                    [],
                    Option.none()
                  ),
                  [
                    "g(a: number, b: number): { [key: string]: number }"
                  ]
                )
              ],
              [
                new Domain.Method(
                  new Domain.NamedDoc(
                    "f",
                    Option.some("a static method description..."),
                    Option.some("1.1.0"),
                    true,
                    [],
                    Option.none()
                  ),
                  ["static f(): void"]
                )
              ],
              [
                new Domain.Property(
                  new Domain.NamedDoc(
                    "a",
                    Option.some("a property..."),
                    Option.some("1.1.0"),
                    true,
                    [],
                    Option.none()
                  ),
                  "readonly a: string"
                )
              ]
            )
          ]
        )
      })

      it("should handle method overloadings", () => {
        expectSuccess(
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
          Parser.parseClasses,
          [
            new Domain.Class(
              new Domain.NamedDoc(
                "Test",
                Option.some("a class description..."),
                Option.some("1.0.0"),
                true,
                [],
                Option.none()
              ),
              "export declare class Test<A> { constructor(readonly value: A) }",
              [
                new Domain.Method(
                  new Domain.NamedDoc(
                    "map",
                    Option.some("a method description..."),
                    Option.some("1.1.0"),
                    true,
                    [],
                    Option.none()
                  ),
                  ["map(f: (a: number) => number): Test", "map(f: (a: string) => string): Test"]
                )
              ],
              [
                new Domain.Method(
                  new Domain.NamedDoc(
                    "f",
                    Option.some("a static method description..."),
                    Option.some("1.1.0"),
                    true,
                    [],
                    Option.none()
                  ),
                  ["static f(x: number): number", "static f(x: string): string"]
                )
              ],
              []
            )
          ]
        )
      })

      it("should ignore internal/ignored methods (#42)", () => {
        expectSuccess(
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
          Parser.parseClasses,
          [
            new Domain.Class(
              new Domain.NamedDoc(
                "Test",
                Option.some("a class description..."),
                Option.some("1.0.0"),
                false,
                [],
                Option.none()
              ),
              "export declare class Test<A>",
              [],
              [],
              []
            )
          ]
        )
      })
    })

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
          new Domain.NamedDoc(
            "test",
            Option.some(
              "Manages the configuration settings for the widget"
            ),
            Option.some("1.0.0"),
            true,
            [],
            Option.none()
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

      it("should support absence of module documentation when no documentation is enforced", () => {
        expectSuccess(
          "export const a: number = 1",
          Parser.parseModuleDocumentation,
          new Domain.NamedDoc(
            "test",
            Option.none(),
            Option.none(),
            false,
            [],
            Option.none()
          ),
          { enforceVersion: false }
        )
      })
    })

    describe("parseExports", () => {
      it("should return no `Export`s if the file is empty", () => {
        expectSuccess("", Parser.parseExports, [])
      })

      it("should handle renamimg", () => {
        expectSuccess(
          `const a = 1;
          export {
            /**
             * @since 1.0.0
             */
            a as b
          }`,
          Parser.parseExports,
          [
            new Domain.Export(
              new Domain.NamedDoc(
                "b",
                Option.none(),
                Option.some("1.0.0"),
                false,
                [],
                Option.none()
              ),
              "export declare const b: 1"
            )
          ]
        )
      })

      it("should return an `Export`", () => {
        expectSuccess(
          `export {
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
          Parser.parseExports,
          [
            new Domain.Export(
              new Domain.NamedDoc(
                "a",
                Option.some("description_of_a"),
                Option.some("1.0.0"),
                false,
                [],
                Option.none()
              ),
              "export declare const a: any"
            ),
            new Domain.Export(
              new Domain.NamedDoc(
                "b",
                Option.some("description_of_b"),
                Option.some("2.0.0"),
                false,
                [],
                Option.none()
              ),
              "export declare const b: any"
            )
          ]
        )
      })

      it("should raise an error if `@since` tag is missing in export", () => {
        expectFailure("export { a }", Parser.parseExports, [
          `Missing ${chalk.bold("a")} documentation in ${chalk.bold("test")}`
        ])
      })

      it("should retrieve an export signature", () => {
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
          Effect.provideService(Parser.Source, {
            path: ["test"],
            sourceFile
          }),
          Effect.provideService(Configuration.Configuration, defaultConfig),
          Effect.runSyncExit
        )
        assert.deepStrictEqual(
          actual,
          Exit.succeed([
            new Domain.Export(
              new Domain.NamedDoc(
                "b",
                Option.none(),
                Option.some("1.0.0"),
                false,
                [],
                Option.none()
              ),
              "export declare const b: 1"
            )
          ])
        )
      })

      it("parses export *", () => {
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
          Effect.provideService(Parser.Source, {
            path: ["test"],
            sourceFile
          }),
          Effect.provideService(Configuration.Configuration, defaultConfig),
          Effect.runSyncExit
        )

        assert.deepStrictEqual(
          actual,
          Exit.succeed([
            new Domain.Export(
              new Domain.NamedDoc(
                "From './example'",
                Option.some("Re-exports all named exports from the './example' module."),
                Option.some("1.0.0"),
                false,
                [],
                Option.some("exports")
              ),
              "export * from './example'"
            )
          ])
        )
      })

      it("parse export * as", () => {
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
          Effect.provideService(Parser.Source, {
            path: ["test"],
            sourceFile
          }),
          Effect.provideService(Configuration.Configuration, defaultConfig),
          Effect.runSyncExit
        )

        assert.deepStrictEqual(
          actual,
          Exit.succeed([
            new Domain.Export(
              new Domain.NamedDoc(
                "From './example'",
                Option.some(
                  "Re-exports all named exports from the './example' module as `example`."
                ),
                Option.some("1.0.0"),
                false,
                [],
                Option.some("exports")
              ),
              "export * as example from './example'"
            )
          ])
        )
      })
    })

    describe("parseModule", () => {
      it("should raise an error if `@since` tag is missing", async () => {
        expectFailure(`import * as assert from 'assert'`, Parser.parseModule, [
          `Missing ${chalk.bold("documentation")} in ${chalk.bold("test")} module`
        ])
      })

      it("should not require an example for modules when `enforceExamples` is set to true (#38)", () => {
        expectSuccess(
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
          Parser.parseModule,
          new Domain.Module(
            new Domain.NamedDoc(
              "test",
              Option.some("This is the assert module."),
              Option.some("1.0.0"),
              false,
              [],
              Option.none()
            ),
            ["test"],
            [],
            [],
            [],
            [],
            [
              new Domain.Constant(
                new Domain.NamedDoc(
                  "foo",
                  Option.some("This is the foo export."),
                  Option.some("1.0.0"),
                  false,
                  [new Domain.Example(`import { foo } from 'test'\n\nconsole.log(foo)`)],
                  Option.some("foo")
                ),
                "export declare const foo: \"foo\""
              )
            ],
            [],
            []
          ),
          { enforceExamples: true }
        )
      })
    })

    describe("parseFile", () => {
      it("should not parse a non-existent file", async () => {
        const file = File.createFile("non-existent.ts", "")
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
  })

  describe("utils", () => {
    describe("getDoc", () => {
      it("should parse comment information", () => {
        const text = String.stripMargin(
          `|/**
           | * description
           | * @category instances
           | * @since 1.0.0
           | */`
        )
        expectSuccess(
          "",
          Parser.getDoc("name", text),
          new Domain.Doc(
            Option.some("description"),
            Option.some("1.0.0"),
            false,
            [],
            Option.some("instances")
          )
        )
      })

      it("should fail if an empty comment tag is provided", () => {
        const text = String.stripMargin(
          `|/**
           | * @category
           | * @since 1.0.0
           | */`
        )
        expectFailure(
          "",
          Parser.getDoc("name", text),
          `Missing ${chalk.bold("@category")} tag in ${chalk.bold("test#name")} documentation`
        )
      })

      it("should require a description if `enforceDescriptions` is set to true", () => {
        const text = String.stripMargin(
          `|/**
           | * @category instances
           | * @since 1.0.0
           | */`
        )
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
        const text = String.stripMargin(
          `|/**
           | * description
           | * @category instances
           | * @since 1.0.0
           | */`
        )
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
        const text = String.stripMargin(
          `|/**
           | * description
           | * @example
           | * @category instances
           | * @since 1.0.0
           | */`
        )
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
            Option.some("description"),
            Option.none(),
            false,
            [],
            Option.some("instances")
          ),
          { enforceVersion: false }
        )
      })
    })

    it("parseComment", () => {
      assert.deepStrictEqual(Parser.parseComment(""), {
        description: Option.none(),
        tags: {}
      })

      assert.deepStrictEqual(Parser.parseComment("/** description */"), {
        description: Option.some("description"),
        tags: {}
      })

      assert.deepStrictEqual(
        Parser.parseComment("/** description\n * @since 1.0.0\n */"),
        {
          description: Option.some("description"),
          tags: {
            since: [Option.some("1.0.0")]
          }
        }
      )

      assert.deepStrictEqual(
        Parser.parseComment("/** description\n * @deprecated\n */"),
        {
          description: Option.some("description"),
          tags: {
            deprecated: [Option.none()]
          }
        }
      )

      assert.deepStrictEqual(
        Parser.parseComment("/** description\n * @category instance\n */"),
        {
          description: Option.some("description"),
          tags: {
            category: [Option.some("instance")]
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
