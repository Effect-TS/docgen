import { ConfigurationSchema } from "@effect/docgen/Configuration"
import * as NodeContext from "@effect/platform-node/NodeContext"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as FileSystem from "@effect/platform/FileSystem"
import { JSONSchema } from "@effect/schema"
import { Effect } from "effect"

const jsonSchema = JSON.stringify(JSONSchema.make(ConfigurationSchema), null, 2)

const program = Effect.gen(function*(_) {
  const fs = yield* _(FileSystem.FileSystem)
  yield* _(Effect.log("Writing config schema"))
  yield* _(fs.writeFileString("schema.json", jsonSchema))
  yield* _(Effect.log("Wrote schema to ./schema.json"))
})

program.pipe(
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain
)
