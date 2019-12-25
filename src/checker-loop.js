'use strict';

const _ = require('lodash');

const { getLogger, loggerInit } = require('./logger');
const Checker = require('./Checker');
const ecsApi = require('./ecs-api');
const Messager = require('./Messager');
const utils = require('./utils');
const defaults = require('./defaults');

const { DEPLOYMENT_STATES } = require('./consts');

async function runCheck(params, messageSender, messageFormatter) {
  const { providedLogger, serviceNamesOverride, checkIntervalSeconds, secondsUntilAlert, logInterval, refreshServicesInterval, ecsCluster } = _.merge(defaults, params);
  loggerInit(providedLogger);
  const messager = new Messager(messageSender, messageFormatter);

  let serviceNameBatches = await _getServiceNames(ecsCluster, serviceNamesOverride);
  await messager.sendMonaDeployedAlert(_.flatten(serviceNameBatches), ecsCluster);

  if (serviceNamesOverride.length === 0) {
    setInterval(async () => {
      getLogger().info('Refreshing service names');
      serviceNameBatches = await _getServiceNames(ecsCluster, serviceNamesOverride);
    }, refreshServicesInterval * 1000);
  }

  const checker = new Checker(secondsUntilAlert);
  const intervalLogger = utils.runInInterval(logInterval, utils.printLogContent);

  setInterval(async () => {
    const serviceStates = await ecsApi.runCheckInBatches(ecsCluster, serviceNameBatches);
    const results = checker.iterate(serviceStates);

    intervalLogger(results.serviceDeployStates);
    await messager.sendMessages(results);
  }, checkIntervalSeconds * 1000);
}

async function _getServiceNames(ecsCluster, serviceNamesOverride) {
  if (serviceNamesOverride.length > 0) {
    if (serviceNamesOverride.length > 10) {
      // The ECS API doesn't accept lists of services with more than 10 services
      // using override with list length > 10 is not supported
      throw new Error('Service list can\'t be more than 10 services long');
    }
    getLogger().info('Running for provided services. Will not refresh service names');
    return [serviceNamesOverride];
  }
  return await ecsApi.getExistingServicesInBatches(ecsCluster);
}

module.exports = {
  runCheck,
  DEPLOYMENT_STATES,
};
