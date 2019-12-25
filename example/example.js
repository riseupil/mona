'use strict';

const messageSender = require('./message-senders/console');

const config = {
  ecsCluster: 'prod',
  logger: console,
};

const Mona = require('../index');

(async () => {
  await Mona(config, messageSender);
})();
