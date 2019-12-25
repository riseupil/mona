'use strict';

let logger = new Error('Used logger before loggerInit');

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
  return logger;
}

module.exports = {
  loggerInit,
  getLogger,
};
