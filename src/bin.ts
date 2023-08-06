#!/usr/bin/env node

/**
 * CLI
 *
 * @since 1.0.0
 */

import chalk from "chalk"
import { Effect } from "effect"
import { main } from "./index"

Effect.runPromise(main).catch((defect) => {
  console.error(chalk.bold.red("Unexpected Error"))
  console.error(defect)
  process.exit(1)
})
