#!/usr/bin/env node

/**
 * @since 1.0.0
 */

import * as NodeContext from "@effect/platform-node/NodeContext"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Logger from "effect/Logger"
import * as LogLevel from "effect/LogLevel"
import * as Cli from "./Cli.js"
import * as Configuration from "./Configuration.js"
import { SimpleLogger } from "./Logger.js"
import * as Process from "./Process.js"

/** @internal */
export const MainLive = Configuration.configProviderLayer.pipe(
  Layer.provideMerge(Layer.mergeAll(
    Logger.replace(Logger.defaultLogger, SimpleLogger),
    Logger.minimumLogLevel(LogLevel.Info),
    Process.layer,
    NodeContext.layer
  ))
)

Cli.run(process.argv).pipe(
  Effect.provide(MainLive),
  NodeRuntime.runMain
)
