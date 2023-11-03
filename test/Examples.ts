import { assert, expect, describe, it } from "vitest"

describe("Markdown", () => {
  it("function > printModule (0)", async () => {
    const Markdown = await import("@effect/docgen/Markdown")
    const Domain = await import("@effect/docgen/Domain")
    const { Option } = await import("effect")
    
    const doc = Domain.createNamedDoc("tests", Option.none(), Option.some("1.0.0"), false, [], Option.none())
    const m = Domain.createModule(doc, ["src", "tests.ts"], [], [], [], [], [], [], [])
    console.log(Markdown.printModule(m, 0))
  })
})
