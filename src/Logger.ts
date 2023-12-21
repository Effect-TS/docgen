/**
 * @since 1.0.0
 */
import chalk from "chalk"
import * as Logger from "effect/Logger"

/**
 * @category logging
 * @since 1.0.0
 */
export const SimpleLogger = Logger.make(({ logLevel, message }) => {
  if (logLevel._tag === "Debug") {
    globalThis.console.log(chalk.gray(`[${logLevel.label}] ${message}`))
  } else {
    globalThis.console.log(`[${logLevel.label}] ${message}`)
  }
})
