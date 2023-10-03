import * as Domain from "@effect/docgen/Domain"
import * as assert from "assert"
import { Option, ReadonlyArray } from "effect"

const createDefaultNamedDoc = (name: string) =>
  Domain.createNamedDoc(
    name,
    Option.none(),
    Option.some("1.0.0"),
    false,
    [],
    Option.none()
  )

describe.concurrent("Domain", () => {
  describe.concurrent("constructors", () => {
    it("createNamedDoc", () => {
      assert.deepStrictEqual(createDefaultNamedDoc("A"), {
        name: "A",
        description: Option.none(),
        since: Option.some("1.0.0"),
        deprecated: false,
        examples: [],
        category: Option.none()
      })
    })

    it("createModule", () => {
      const model = Domain.createModule(
        createDefaultNamedDoc("test"),
        ["src", "index.ts"],
        [],
        [],
        [],
        [],
        [],
        [],
        []
      )

      assert.deepStrictEqual(model, {
        ...createDefaultNamedDoc("test"),
        path: ["src", "index.ts"],
        classes: [],
        interfaces: [],
        functions: [],
        typeAliases: [],
        constants: [],
        exports: [],
        namespaces: []
      })
    })

    it("createClass", () => {
      const model = Domain.createClass(
        createDefaultNamedDoc("A"),
        "declare class A { constructor() }",
        [],
        [],
        []
      )

      assert.deepStrictEqual(model, {
        _tag: "Class",
        ...createDefaultNamedDoc("A"),
        signature: "declare class A { constructor() }",
        methods: [],
        staticMethods: [],
        properties: []
      })
    })

    it("createConstant", () => {
      const model = Domain.createConstant(
        createDefaultNamedDoc("foo"),
        "declare const foo: string"
      )

      assert.deepStrictEqual(model, {
        _tag: "Constant",
        ...createDefaultNamedDoc("foo"),
        signature: "declare const foo: string"
      })
    })

    it("createMethod", () => {
      const model = Domain.createMethod(createDefaultNamedDoc("foo"), ["foo(): string"])

      assert.deepStrictEqual(model, {
        ...createDefaultNamedDoc("foo"),
        signatures: ["foo(): string"]
      })
    })

    it("createProperty", () => {
      const model = Domain.createProperty(createDefaultNamedDoc("foo"), "foo: string")

      assert.deepStrictEqual(model, {
        ...createDefaultNamedDoc("foo"),
        signature: "foo: string"
      })
    })

    it("createInterface", () => {
      const model = Domain.createInterface(createDefaultNamedDoc("A"), "interface A {}")

      assert.deepStrictEqual(model, {
        _tag: "Interface",
        ...createDefaultNamedDoc("A"),
        signature: "interface A {}"
      })
    })

    it("createFunction", () => {
      const model = Domain.createFunction(createDefaultNamedDoc("func"), [
        "declare function func(): string"
      ])

      assert.deepStrictEqual(model, {
        _tag: "Function",
        ...createDefaultNamedDoc("func"),
        signatures: ["declare function func(): string"]
      })
    })

    it("createTypeAlias", () => {
      const model = Domain.createTypeAlias(createDefaultNamedDoc("A"), "type A = string")

      assert.deepStrictEqual(model, {
        _tag: "TypeAlias",
        ...createDefaultNamedDoc("A"),
        signature: "type A = string"
      })
    })

    it("createExport", () => {
      const model = Domain.createExport(
        createDefaultNamedDoc("foo"),
        "export declare const foo: string"
      )

      assert.deepStrictEqual(model, {
        _tag: "Export",
        ...createDefaultNamedDoc("foo"),
        signature: "export declare const foo: string"
      })
    })
  })

  it("ByPath", () => {
    const m1 = Domain.createModule(
      createDefaultNamedDoc("test1"),
      ["src", "test1.ts"],
      [],
      [],
      [],
      [],
      [],
      [],
      []
    )

    const m2 = Domain.createModule(
      createDefaultNamedDoc("test1"),
      ["src", "test1.ts"],
      [],
      [],
      [],
      [],
      [],
      [],
      []
    )

    const sorted = ReadonlyArray.sort([m2, m1], Domain.ByPath)

    assert.deepStrictEqual(sorted, [m1, m2])
  })
})
