import { JSONSchema, Schema } from "@effect/schema"
import { Effect } from "effect"
import { PartialConfigSchema } from "../src/ConfigSchema"
import * as FileSystem from "../src/FileSystem"

const configJsonSchema = JSONSchema.from(
  PartialConfigSchema.pipe(
    Schema.extend(Schema.struct({ "$schema": Schema.string })),
    Schema.partial
  )
)

const pathTo = "schema.json"

const program = Effect.gen(function*(_) {
  console.log(`Writing Config schema to ${pathTo}...`)
  const fs = yield* _(FileSystem.FileSystem)

  yield* _(fs.writeFile(pathTo, JSON.stringify(configJsonSchema, null, 2)))
  console.log("Completed.")
}).pipe(
  Effect.provide(FileSystem.FileSystemLive)
)

Effect.runPromise(program).catch(console.error)
