'use strict';

const moment = require('moment');
const { DEPLOYMENT_STATES } = require('../src/consts');

const Checker = require('../src/Checker');

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

describe('Deployment checker', () => {
  let checker;

  beforeEach(() => {
    const initialApiResults = {
      a: mockResults('a'),
      b: mockResults('b'),
    };
    checker = new Checker(10, initialApiResults);
  });

  describe('Calculate deployment status', () => {
    test('When deployment is stable, state is STABLE', () => {
      const apiResults = {
        a: mockResults('a'),
        b: mockResults('b'),
      };

      const result = checker.iterate(apiResults);
      expect(result.serviceDeployStates.a).toEqual(DEPLOYMENT_STATES.STABLE);
      expect(result.serviceDeployStates.b).toEqual(DEPLOYMENT_STATES.STABLE);
    });

    test('When deployment is not stable, state is DEPLOYING', () => {
      const apiResults = {
        a: mockResults('a', { deploymentId: 'deployment2', deploymentRunningCount: 0 }),
        b: mockResults('b'),
      };

      const result = checker.iterate(apiResults);
      expect(result.serviceDeployStates.a).toEqual(DEPLOYMENT_STATES.DEPLOYING);
      expect(result.serviceDeployStates.b).toEqual(DEPLOYMENT_STATES.STABLE);
    });

    test('When deployment is not stable, but deploymentId didn\'t change, state is RECOVER', () => {
      const result1 = checker.iterate({ a: mockResults('a') });
      expect(result1.serviceDeployStates.a).toEqual(DEPLOYMENT_STATES.STABLE);

      const result2 = checker.iterate({ a: mockResults('a', { deploymentRunningCount: 0 }) });
      expect(result2.serviceDeployStates.a).toEqual(DEPLOYMENT_STATES.RECOVER);
    });

    test('When deployment is not stable, and desiredCount changed, state is SCALING', () => {
      const result1 = checker.iterate({ a: mockResults('a') });
      expect(result1.serviceDeployStates.a).toEqual(DEPLOYMENT_STATES.STABLE);

      const result2 = checker.iterate({ a: mockResults('a', { desiredCount: 2 }) });
      expect(result2.serviceDeployStates.a).toEqual(DEPLOYMENT_STATES.SCALING);
    });

    test('When both deployment changed and desiredCount changed, state is DEPLOYING', () => {
      const result = checker.iterate({ a: mockResults('a', { deploymentId: 'a', desiredCount: 2 }) });
      expect(result.serviceDeployStates.a).toEqual(DEPLOYMENT_STATES.DEPLOYING);
    });
  });

  describe('Calculate alerts', () => {
    test('When deployment has no changes, there should be not alerts', () => {
      const apiResults = [
        {
          a: mockResults('a', { deploymentId: 'a', deploymentRunningCount: 0 }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { deploymentId: 'a', deploymentRunningCount: 0 }),
          b: mockResults('b'),
        },
      ];
      const result1 = checker.iterate(apiResults[0]);
      checkAlerts(result1, { serviceDeployingAlerts: 1 });

      const result2 = checker.iterate(apiResults[1]);
      checkAlerts(result2, {});
    });

    test('When deployment starts, should alert', () => {
      const apiResults = [
        {
          a: mockResults('a'),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { deploymentRunningCount: 0, deploymentId: 'a' }),
          b: mockResults('b'),
        },
      ];
      const result1 = checker.iterate(apiResults[0]);
      checkAlerts(result1, {});

      const result2 = checker.iterate(apiResults[1]);
      checkAlerts(result2, { serviceDeployingAlerts: 1 });
    });

    test('When deployment done, should alert', () => {
      const apiResults = [
        {
          a: mockResults('a', { deploymentId: 'a', deploymentRunningCount: 0 }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { deploymentId: 'a' }),
          b: mockResults('b'),
        },
      ];
      const result1 = checker.iterate(apiResults[0]);
      checkAlerts(result1, { serviceDeployingAlerts: 1 });

      const result2 = checker.iterate(apiResults[1]);
      checkAlerts(result2, { serviceDeployDoneAlerts: 1 });
    });

    test('When deployment is running for a long time, should alert', () => {
      const apiResults = [
        {
          a: mockResults('a', { deploymentRunningCount: 0, deploymentId: 'deployId2' }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { deploymentRunningCount: 0, deploymentId: 'deployId2', deploymentCreated: moment().subtract(1, 'h') }),
          b: mockResults('b'),
        },
      ];
      const result1 = checker.iterate(apiResults[0]);
      checkAlerts(result1, { serviceDeployingAlerts: 1 });

      const result2 = checker.iterate(apiResults[1]);
      checkAlerts(result2, { serviceDeployTimeoutAlerts: 1 });
    });

    test('When deployment is running again for same ver, should alert', () => {
      const apiResults = [
        {
          a: mockResults('a', { deploymentRunningCount: 0, deploymentId: 'deployId1' }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { deploymentRunningCount: 0, deploymentId: 'deployId2' }),
          b: mockResults('b'),
        },
      ];
      const result1 = checker.iterate(apiResults[0]);
      checkAlerts(result1, { serviceDeployingAlerts: 1 });

      const result2 = checker.iterate(apiResults[1]);
      checkAlerts(result2, { serviceDeployingAlerts: 1 });
    });

    test('When deployment is running again for same taskDef, should alert scaling', () => {
      const apiResults = [
        {
          a: mockResults('a', { deploymentRunningCount: 0, deploymentId: 'deployId1' }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { deploymentId: 'deployId1' }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { deploymentRunningCount: 0, deploymentId: 'deployId1' }),
          b: mockResults('b'),
        },
      ];
      const result1 = checker.iterate(apiResults[0]);
      checkAlerts(result1, { serviceDeployingAlerts: 1 });

      const result2 = checker.iterate(apiResults[1]);
      checkAlerts(result2, { serviceDeployDoneAlerts: 1 });

      const result3 = checker.iterate(apiResults[2]);
      checkAlerts(result3, { serviceRecoverAlerts: 1 });
    });

    test('When increased desired count, should alert scaling', () => {
      const apiResults = [
        {
          a: mockResults('a'),
        },
        {
          a: mockResults('a', { desiredCount: 2 }),
        },
      ];
      const result1 = checker.iterate(apiResults[0]);
      checkAlerts(result1, {});

      const result2 = checker.iterate(apiResults[1]);
      checkAlerts(result2, { serviceScalingAlerts: 1 });
    });

    test('When deployment is running again for same taskDef, should alert scaling - Mona just started', () => {
      const apiResults = [
        {
          a: mockResults('a', { deploymentId: 'deployId1' }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { deploymentRunningCount: 0, deploymentId: 'deployId1' }),
          b: mockResults('b'),
        },
      ];
      const result1 = checker.iterate(apiResults[0]);
      checkAlerts(result1, {});

      const result2 = checker.iterate(apiResults[1]);
      checkAlerts(result2, { serviceRecoverAlerts: 1 });
    });

    test('Deployment alerts should happen once per deploy', () => {
      const apiResults = [
        {
          a: mockResults('a', { deploymentId: 'deployId1' }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { deploymentRunningCount: 0, deploymentId: 'deployId2' }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { deploymentRunningCount: 0, deploymentId: 'deployId2' }),
          b: mockResults('b'),
        },
      ];
      const result1 = checker.iterate(apiResults[0]);
      checkAlerts(result1, {});

      const result2 = checker.iterate(apiResults[1]);
      checkAlerts(result2, { serviceDeployingAlerts: 1 });

      const result3 = checker.iterate(apiResults[2]);
      checkAlerts(result3, {});
    });

    test('Scaling alerts should happen once per deploy', () => {
      const apiResults = [
        {
          a: mockResults('a', { deploymentId: 'deployId1' }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { deploymentRunningCount: 0, deploymentId: 'deployId1' }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { deploymentRunningCount: 0, deploymentId: 'deployId1' }),
          b: mockResults('b'),
        },
      ];
      const result1 = checker.iterate(apiResults[0]);
      checkAlerts(result1, {});

      const result2 = checker.iterate(apiResults[1]);
      checkAlerts(result2, { serviceRecoverAlerts: 1 });

      const result3 = checker.iterate(apiResults[2]);
      checkAlerts(result3, {});
    });

    test('Send deploy done alerts after recovery', () => {
      const apiResults = [
        {
          a: mockResults('a', {}),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { deploymentRunningCount: 0 }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', {}),
          b: mockResults('b'),
        },
      ];
      const result1 = checker.iterate(apiResults[0]);
      checkAlerts(result1, {});

      const result2 = checker.iterate(apiResults[1]);
      checkAlerts(result2, { serviceRecoverAlerts: 1 });

      const result3 = checker.iterate(apiResults[2]);
      checkAlerts(result3, { serviceDeployDoneAlerts: 1 });
    });
  });
});
