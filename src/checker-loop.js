'use strict';

const _ = require('lodash');

const { getLogger, loggerInit } = require('./logger');
const Checker = require('./Checker');
const ecsApi = require('./ecs-api');
const Messager = require('./Messager');
const defaults = require('./defaults');

const { DEPLOYMENT_STATES } = require('./consts');

async function runCheck(params, messageSender, messageFormatter) {
  const { providedLogger, serviceNamesOverride, checkIntervalSeconds, secondsUntilAlert, refreshServicesInterval, ecsCluster, ecsRegion } = _.merge(defaults, params);
  loggerInit(providedLogger);
  ecsApi.initECS(ecsRegion);

  const messager = new Messager(messageSender, messageFormatter);

  let serviceNameBatches = await _getServiceNames(ecsCluster, serviceNamesOverride);
  await messager.sendMonaDeployedAlert(_.flatten(serviceNameBatches), ecsCluster);

  if (serviceNamesOverride.length === 0) {
    setInterval(async () => {
      getLogger().info('Refreshing service names');
      serviceNameBatches = await _getServiceNames(ecsCluster, serviceNamesOverride);
    }, refreshServicesInterval * 1000);
  }

  const initialServiceStates = await ecsApi.runCheckInBatches(ecsCluster, serviceNameBatches);
  const checker = new Checker(secondsUntilAlert, initialServiceStates);

  setInterval(async () => {
    const serviceStates = await ecsApi.runCheckInBatches(ecsCluster, serviceNameBatches);
    const results = checker.iterate(serviceStates);
    await messager.sendMessages(results);
  }, checkIntervalSeconds * 1000);
}

async function _getServiceNames(ecsCluster, serviceNamesOverride) {
  if (serviceNamesOverride.length > 0) {
    getLogger().info('Running for provided services. Will not refresh service names');
    return _.chunk(serviceNamesOverride, 10);
  }
  return await ecsApi.getExistingServicesInBatches(ecsCluster);
}

module.exports = {
  runCheck,
  DEPLOYMENT_STATES,
};
