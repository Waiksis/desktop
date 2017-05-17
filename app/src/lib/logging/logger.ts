import { app } from 'electron'
import * as winston from 'winston'
require('winston-daily-rotate-file')

import * as Fs from 'fs-extra'
import * as Path from 'path'

import { ElectronConsole } from './electron-console'

export const LogFolder = 'logs'

export interface ILogger {
  readonly log: (level: string, message: string) => void
  readonly debug: (message: string) => void
  readonly info: (message: string) => void
  readonly error: (message: string) => void
}

/** resolve the log file location based on the current environment */
export function getLogFilePath(directory: string): string {
  const environment = process.env.NODE_ENV || 'production'
  const fileName = `desktop.${environment}.log`
  return Path.join(directory, fileName)
}

/**
 * Initializes winston and returns a subset of the available log level
 * methods (debug, info, error). This method should only be called once
 * during an applications lifetime.
 * 
 * @param path The path where to write log files. This path will have
 *             the current date prepended to the basename part of the
 *             path such that passing a path '/logs/foo' will end up
 *             writing to '/logs/2017-05-17.foo'
 */
function initializeWinston(path: string): ILogger {
  const fileLogger = new winston.transports.DailyRotateFile({
    filename: path,
    // We'll do this ourselves, thank you
    handleExceptions: false,
    json: false,
    datePattern: 'yyyy-MM-dd.',
    prepend: true,
    // log everything interesting (info and up)
    level: 'info',
  })

  const level = process.env.NODE_ENV === 'development' ? 'debug' : 'error'
  const consoleLogger = new ElectronConsole({
    level,
  })

  winston.configure({
    transports: [
      consoleLogger,
      fileLogger,
    ],
  })

  return {
    log: winston.log,
    debug: winston.debug,
    info: winston.info,
    error: winston.error,
  }
}

let logger: ILogger | null = null

/**
 * Initializes and configures winston (if necessary) and returns an ILogger
 * instance configured to write to Electron's console and to disk.
 */
export async function getLogger(): Promise<ILogger> {

  if (logger) {
    return logger
  }

  const userData = app.getPath('userData')
  const directory = Path.join(userData, LogFolder)

  return await new Promise<ILogger>((resolve, reject) => {
    Fs.mkdir(directory, (error) => {
      if (error) {
        if (error.code !== 'EEXIST') {
          reject(error)
          return
        }
      }

      const logger = initializeWinston(getLogFilePath(directory))
      resolve(logger)
    })
  })
}

