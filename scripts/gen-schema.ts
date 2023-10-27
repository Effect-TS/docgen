import { JSONSchema } from "@effect/schema"
import { Effect } from "effect"
import * as path from "node:path"
import { PartialConfigSchema } from "../src/ConfigSchema"
import * as FileSystem from "../src/FileSystem"

const configJsonSchema = JSONSchema.from(
  PartialConfigSchema
)

const pathTo = path.join("dist", "schema.json")

const program = Effect.gen(function*(_) {
  console.log(`Writing Config schema to ${pathTo}...`)
  const fs = yield* _(FileSystem.FileSystem)

  yield* _(fs.writeFile(pathTo, JSON.stringify(configJsonSchema, null, 2)))
  console.log("Completed.")
}).pipe(
  Effect.provide(FileSystem.FileSystemLive)
)

Effect.runPromise(program).catch(console.error)
