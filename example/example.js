'use strict';

const messageSender = require('./message-senders/console');

const config = {
  ecsCluster: 'prod',
  AWSRegion: 'us-west-1',
  logger: console,
};

const Mona = require('../index');

(async () => {
  await Mona(config, messageSender);
})();
