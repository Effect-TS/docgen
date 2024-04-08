import * as assert from 'assert'
import * as Markdown from '../../src/Markdown'
import * as Domain from '../../src/Domain'
import { Option } from "effect"

const doc = Domain.createNamedDoc("tests", Option.none(), Option.some("1.0.0"), false, [], Option.none())
const m = Domain.createModule(doc, ["src", "tests.ts"], [], [], [], [], [], [], [])
console.log(Markdown.printModule(m, 0))
const a = b
assert.deepStrictEqual(1, 2)
