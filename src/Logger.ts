/**
 * @since 1.0.0
 */
import * as Logger from "@effect/io/Logger"
import chalk from "chalk"

/**
 * @category logging
 * @since 1.0.0
 */
export const SimpleLogger = Logger.make((_, logLevel, message) => {
  if (logLevel._tag === "Debug") {
    globalThis.console.log(chalk.gray(`[${logLevel.label}] ${message}`))
  } else {
    globalThis.console.log(`[${logLevel.label}] ${message}`)
  }
})
