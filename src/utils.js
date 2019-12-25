'use strict';

const { getLogger } = require('./logger');

function runInInterval(interval, func) {
  let logIntervalCounter = 0;
  return logContent => {
    logIntervalCounter += 1;
    if (logIntervalCounter === interval) {
      func(logContent);
      logIntervalCounter = 0;
    }
  };
}

function printLogContent(logContent) {
  getLogger().debug(JSON.stringify(logContent));
}

module.exports = {
  runInInterval,
  printLogContent,
};
