'use strict';

const moment = require('moment');

function mockResults(service, overrides = {}) {
  return {
    service,
    deploymentId: overrides.deploymentId || 'deploymentId',
    deploymentCreated: overrides.deploymentCreated || moment(),
    desiredCount: ('desiredCount' in overrides) ? overrides.desiredCount : 1,
    runningCount: ('runningCount' in overrides) ? overrides.runningCount : 1,
    deploymentRunningCount: ('deploymentRunningCount' in overrides) ? overrides.deploymentRunningCount : 1,
    taskDef: overrides.taskDef || 'taskDef',
  };
}

function checkAlerts(result, expected) {
  expect(_createResultObject(result)).toEqual(_createExpectedObject(expected));
}

function _createResultObject(result) {
  return {
    serviceDeployingAlerts: result.serviceDeployingAlerts.length,
    serviceDeployDoneAlerts: result.serviceDeployDoneAlerts.length,
    serviceDeployTimeoutAlerts: result.serviceDeployTimeoutAlerts.length,
    serviceScalingAlerts: result.serviceScalingAlerts.length,
    serviceRecoverAlerts: result.serviceRecoverAlerts.length,
  }
}

function _createExpectedObject(expected) {
  return {
    serviceDeployingAlerts: ('serviceDeployingAlerts' in expected) ? expected.serviceDeployingAlerts : 0,
    serviceDeployDoneAlerts: ('serviceDeployDoneAlerts' in expected) ? expected.serviceDeployDoneAlerts : 0,
    serviceDeployTimeoutAlerts: ('serviceDeployTimeoutAlerts' in expected) ? expected.serviceDeployTimeoutAlerts : 0,
    serviceScalingAlerts: ('serviceScalingAlerts' in expected) ? expected.serviceScalingAlerts : 0,
    serviceRecoverAlerts: ('serviceRecoverAlerts' in expected) ? expected.serviceRecoverAlerts : 0,
  }
}

module.exports = {
  mockResults,
  checkAlerts,
};
