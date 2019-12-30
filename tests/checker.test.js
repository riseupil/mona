'use strict';

const moment = require('moment');
const { DEPLOYMENT_STATES } = require('../src/consts');

const CheckerTest = require('../src/Checker');

function mockResults(service, overrides = {}) {
  return {
    service,
    deploymentId: overrides.deploymentId || 'deploymentId',
    deploymentCreated: overrides.deploymentCreated || moment(),
    desiredCount: ('desiredCount' in overrides) ? overrides.desiredCount : 1,
    runningCount: ('runningCount' in overrides) ? overrides.runningCount : 1,
    taskDef: overrides.taskDef || 'taskDef',
  };
}

function checkAlerts(result, serviceDeployingAlerts, serviceDeployDoneAlerts, serviceDeployTimeoutAlerts, serviceScalingAlerts) {
  expect(_createResultObject(result)).toEqual({ serviceDeployingAlerts, serviceDeployDoneAlerts, serviceDeployTimeoutAlerts, serviceScalingAlerts });
}

function _createResultObject(result) {
  return {
    serviceDeployingAlerts: result.serviceDeployingAlerts.length,
    serviceDeployDoneAlerts: result.serviceDeployDoneAlerts.length,
    serviceDeployTimeoutAlerts: result.serviceDeployTimeoutAlerts.length,
    serviceScalingAlerts: result.serviceScalingAlerts.length,
  }
}

describe('Deployment checker', () => {
  describe('Calculate deployment status', () => {
    test('When deployment is stable, state is STABLE', () => {
      const checker = new CheckerTest();
      const apiResults = {
        a: mockResults('a'),
        b: mockResults('b'),
      };
      const result = checker.iterate(apiResults);
      expect(result.serviceDeployStates.a).toEqual(DEPLOYMENT_STATES.STABLE);
      expect(result.serviceDeployStates.b).toEqual(DEPLOYMENT_STATES.STABLE);
    });

    test('When deployment is not stable, state is DEPLOYING', () => {
      const checker = new CheckerTest();
      const apiResults = {
        a: mockResults('a', { runningCount: 0 }),
        b: mockResults('b'),
      };
      const result = checker.iterate(apiResults);
      expect(result.serviceDeployStates.a).toEqual(DEPLOYMENT_STATES.DEPLOYING);
      expect(result.serviceDeployStates.b).toEqual(DEPLOYMENT_STATES.STABLE);
    });

    test('When deployment is not stable, but taskId didn\'t change, state is SCALING', () => {
      const checker = new CheckerTest();
      const result1 = checker.iterate({ a: mockResults('a', { runningCount: 0, deploymentId: 'a' }) });
      expect(result1.serviceDeployStates.a).toEqual(DEPLOYMENT_STATES.DEPLOYING);

      const result2 = checker.iterate({ a: mockResults('a', { deploymentId: 'a' }) });
      expect(result2.serviceDeployStates.a).toEqual(DEPLOYMENT_STATES.STABLE);

      const result3 = checker.iterate({ a: mockResults('a', { runningCount: 0, deploymentId: 'a' }) });
      expect(result3.serviceDeployStates.a).toEqual(DEPLOYMENT_STATES.SCALING);
    });
  });

  describe('Calculate alerts', () => {
    test('When deployment has no changes, there should be not alerts', () => {
      const checker = new CheckerTest();
      const apiResults = [
        {
          a: mockResults('a', { runningCount: 0 }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { runningCount: 0 }),
          b: mockResults('b'),
        },
      ];
      const result1 = checker.iterate(apiResults[0]);
      checkAlerts(result1, 1, 0, 0, 0);

      const result2 = checker.iterate(apiResults[1]);
      checkAlerts(result2, 0, 0, 0, 0);
    });

    test('When deployment starts, should alert', () => {
      const checker = new CheckerTest();
      const apiResults = [
        {
          a: mockResults('a'),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { runningCount: 0, taskDef: 'newTaskDef', deploymentId: 'deployId2' }),
          b: mockResults('b'),
        },
      ];
      const result1 = checker.iterate(apiResults[0]);
      checkAlerts(result1, 0, 0, 0, 0);

      const result2 = checker.iterate(apiResults[1]);
      checkAlerts(result2, 1, 0, 0, 0);
    });

    test('When deployment done, should alert', () => {
      const checker = new CheckerTest();
      const apiResults = [
        {
          a: mockResults('a', { runningCount: 0 }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a'),
          b: mockResults('b'),
        },
      ];
      const result1 = checker.iterate(apiResults[0]);
      checkAlerts(result1, 1, 0, 0, 0);

      const result2 = checker.iterate(apiResults[1]);
      checkAlerts(result2, 0, 1, 0, 0);
    });

    test('When deployment is running for a long time, should alert', () => {
      const checker = new CheckerTest(10);
      const apiResults = [
        {
          a: mockResults('a', { runningCount: 0, deploymentId: 'deployId2' }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { runningCount: 0, deploymentId: 'deployId2', deploymentCreated: moment().subtract(1, 'h') }),
          b: mockResults('b'),
        },
      ];
      const result1 = checker.iterate(apiResults[0]);
      checkAlerts(result1, 1, 0, 0, 0);

      const result2 = checker.iterate(apiResults[1]);
      checkAlerts(result2, 0, 0, 1, 0);
    });

    test('When deployment is running again for same ver, should alert', () => {
      const checker = new CheckerTest(10);
      const apiResults = [
        {
          a: mockResults('a', { runningCount: 0, deploymentId: 'deployId1' }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { runningCount: 0, deploymentId: 'deployId2' }),
          b: mockResults('b'),
        },
      ];
      const result1 = checker.iterate(apiResults[0]);
      checkAlerts(result1, 1, 0, 0, 0);

      const result2 = checker.iterate(apiResults[1]);
      checkAlerts(result2, 1, 0, 0, 0);
    });

    test('When deployment is running again for same taskDef, should alert re-deploy', () => {
      const checker = new CheckerTest(10);
      const apiResults = [
        {
          a: mockResults('a', { runningCount: 0, deploymentId: 'deployId1' }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { deploymentId: 'deployId1' }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { runningCount: 0, deploymentId: 'deployId1' }),
          b: mockResults('b'),
        },
      ];
      const result1 = checker.iterate(apiResults[0]);
      checkAlerts(result1, 1, 0, 0, 0);

      const result2 = checker.iterate(apiResults[1]);
      checkAlerts(result2, 0, 1, 0, 0);

      const result3 = checker.iterate(apiResults[2]);
      checkAlerts(result3, 0, 0, 0, 1);
    });

    test('When deployment is running again for same taskDef, should alert re-deploy - Mona just started', () => {
      const checker = new CheckerTest(10);
      const apiResults = [
        {
          a: mockResults('a', { deploymentId: 'deployId1' }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { runningCount: 0, deploymentId: 'deployId1' }),
          b: mockResults('b'),
        },
      ];
      const result1 = checker.iterate(apiResults[0]);
      checkAlerts(result1, 0, 0, 0, 0);

      const result2 = checker.iterate(apiResults[1]);
      checkAlerts(result2, 0, 0, 0, 1);
    });

    test('Deployment alerts should happen once per deploy', () => {
      const checker = new CheckerTest(10);
      const apiResults = [
        {
          a: mockResults('a', { deploymentId: 'deployId1' }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { runningCount: 0, deploymentId: 'deployId2' }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { runningCount: 0, deploymentId: 'deployId2' }),
          b: mockResults('b'),
        },
      ];
      const result1 = checker.iterate(apiResults[0]);
      checkAlerts(result1, 0, 0, 0, 0);

      const result2 = checker.iterate(apiResults[1]);
      checkAlerts(result2, 1, 0, 0, 0);

      const result3 = checker.iterate(apiResults[2]);
      checkAlerts(result3, 0, 0, 0, 0);
    });

    test('Re-deployment alerts should happen once per deploy', () => {
      const checker = new CheckerTest(10);
      const apiResults = [
        {
          a: mockResults('a', { deploymentId: 'deployId1' }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { runningCount: 0, deploymentId: 'deployId1' }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { runningCount: 0, deploymentId: 'deployId1' }),
          b: mockResults('b'),
        },
      ];
      const result1 = checker.iterate(apiResults[0]);
      checkAlerts(result1, 0, 0, 0, 0);

      const result2 = checker.iterate(apiResults[1]);
      checkAlerts(result2, 0, 0, 0, 1);

      const result3 = checker.iterate(apiResults[2]);
      checkAlerts(result3, 0, 0, 0, 0);
    });
  });
});
