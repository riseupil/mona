'use strict';

const _ = require('lodash');
const AWS = require('aws-sdk');

const { getLogger } = require('./logger');
const { PRIMARY_DEPLOYMENT_STATUS } = require('./consts');

const ecs = new AWS.ECS({
  apiVersion: '2014-11-13',
  region: 'eu-west-1',
});

async function getExistingServicesInBatches(ecsCluster, nextToken = null) {
  const result = await _makeServicesRequest(ecsCluster, nextToken);
  const receivedArns = _.map(result.serviceArns, arn => arn.split('/')[1]);

  if (result.nextToken) {
    return _.concat([receivedArns], await getExistingServicesInBatches(ecsCluster, result.nextToken));
  }
  return [receivedArns];
}

async function _makeServicesRequest(ecsCluster, nextToken) {
  if (nextToken) {
    return await ecs.listServices({
      cluster: ecsCluster,
      nextToken,
    }).promise();
  }
  return await ecs.listServices({
    cluster: ecsCluster,
  }).promise();
}

async function runCheckInBatches(ecsCluster, serviceNameBatches) {
  const results = await Promise.all(_.map(serviceNameBatches, async serviceNamesBatch => await _runSingleCheck(ecsCluster, serviceNamesBatch)));
  return _.merge(...results);
}

async function _runSingleCheck(ecsCluster, serviceNames) {
  const apiResponse = await ecs.describeServices({
    cluster: ecsCluster,
    services: serviceNames,
  }).promise();

  const serviceStates = {};
  _.forEach(serviceNames, service => {
    const serviceState = _extractPrimaryDeploymentState(service, apiResponse);
    if (serviceState) {
      serviceStates[service] = serviceState;
    }
  });
  return serviceStates;
}

function _extractPrimaryDeploymentState(service, apiResponse) {
  const validResponse = _.find(apiResponse.services, s => s.serviceName === service);
  if (!validResponse) {
    getLogger().warn(`The service ${service} returned a bad result. Printing all failures:
${JSON.stringify(apiResponse.failures)}`);
    return null;
  }
  const describeResults = _.find(apiResponse.services, s => s.serviceName === service);
  const primaryDeployment = _.find(describeResults.deployments, d => d.status === PRIMARY_DEPLOYMENT_STATUS);

  return {
    service,
    deploymentId: primaryDeployment.id,
    deploymentCreated: primaryDeployment.updatedAt,
    success: primaryDeployment.runningCount === primaryDeployment.desiredCount,
    taskDef: primaryDeployment.taskDefinition,
    runningCount: primaryDeployment.runningCount,
    desiredCount: primaryDeployment.desiredCount,
  };
}

module.exports = {
  getExistingServicesInBatches,
  runCheckInBatches,
};
