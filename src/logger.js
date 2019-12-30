'use strict';

let logger = false;

function loggerInit(providedLogger) {
  logger = providedLogger || console;
  if (!logger.info) {
    logger.info = logger.log;
  }
  if (!logger.debug) {
    logger.debug = logger.log;
  }
}

function getLogger() {
  if (!logger) {
    throw new Error('Used logger before loggerInit')
  }
  return logger;
}

module.exports = {
  loggerInit,
  getLogger,
};
