#!/usr/bin/env node

/**
 * CLI
 *
 * @example
 * assert.deepStrictEqual(1, 1)
 *
 * @since 1.0.0
 */

import chalk from "chalk"
import { Effect } from "effect"
import { main } from "./Core"

Effect.runPromise(main).catch((defect) => {
  console.error(chalk.bold.red("Unexpected Error"))
  console.error(defect)
  process.exit(1)
})
