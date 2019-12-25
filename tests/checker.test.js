'use strict';

const moment = require('moment');
const { DEPLOYMENT_STATES } = require('../src/consts');

const CheckerTest = require('../src/Checker');

function mockResults(service, overrides = {}) {
  return {
    service,
    deploymentId: overrides.deploymentId || 'deploymentId',
    deploymentCreated: overrides.deploymentCreated || moment(),
    success: ('success' in overrides) ? overrides.success : true,
    taskDef: overrides.taskDef || 'taskDef',
  };
}

function checkAlerts(result, serviceDeployingAlerts, serviceDeployDoneAlerts, serviceDeployTimeoutAlerts, serviceScalingAlerts) {
  expect(result.serviceDeployingAlerts.length).toEqual(serviceDeployingAlerts);
  expect(result.serviceDeployDoneAlerts.length).toEqual(serviceDeployDoneAlerts);
  expect(result.serviceDeployTimeoutAlerts.length).toEqual(serviceDeployTimeoutAlerts);
  expect(result.serviceScalingAlerts.length).toEqual(serviceScalingAlerts);
}

describe('Deployment checker', () => {
  describe('Calculate deployment status', () => {
    test('When deployment is success, state is STABLE', () => {
      const checker = new CheckerTest();
      const apiResults = {
        a: mockResults('a'),
        b: mockResults('b'),
      };
      const result = checker.iterate(apiResults);
      expect(result.serviceDeployStates.a).toEqual(DEPLOYMENT_STATES.STABLE);
      expect(result.serviceDeployStates.b).toEqual(DEPLOYMENT_STATES.STABLE);
    });

    test('When deployment is not success, state is DEPLOYING', () => {
      const checker = new CheckerTest();
      const apiResults = {
        a: mockResults('a', { success: false }),
        b: mockResults('b'),
      };
      const result = checker.iterate(apiResults);
      expect(result.serviceDeployStates.a).toEqual(DEPLOYMENT_STATES.DEPLOYING);
      expect(result.serviceDeployStates.b).toEqual(DEPLOYMENT_STATES.STABLE);
    });

    test('When deployment is not success, but taskId didn\'t change, state is REDEPLOYING', () => {
      const checker = new CheckerTest();
      const result1 = checker.iterate({ a: mockResults('a', { success: false, deploymentId: 'a' }) });
      expect(result1.serviceDeployStates.a).toEqual(DEPLOYMENT_STATES.DEPLOYING);

      const result2 = checker.iterate({ a: mockResults('a', { success: true, deploymentId: 'a' }) });
      expect(result2.serviceDeployStates.a).toEqual(DEPLOYMENT_STATES.STABLE);

      const result3 = checker.iterate({ a: mockResults('a', { success: false, deploymentId: 'a' }) });
      expect(result3.serviceDeployStates.a).toEqual(DEPLOYMENT_STATES.SCALING);
    });
  });

  describe('Calculate alerts', () => {
    test('When deployment has no changes, there should be not alerts', () => {
      const checker = new CheckerTest();
      const apiResults = [
        {
          a: mockResults('a', { success: false }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { success: false }),
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
          a: mockResults('a', { success: false, taskDef: 'newTaskDef', deploymentId: 'deployId2' }),
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
          a: mockResults('a', { success: false }),
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
          a: mockResults('a', { success: false, deploymentId: 'deployId2' }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { success: false, deploymentId: 'deployId2', deploymentCreated: moment().subtract(1, 'h') }),
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
          a: mockResults('a', { success: false, deploymentId: 'deployId1' }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { success: false, deploymentId: 'deployId2' }),
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
          a: mockResults('a', { success: false, deploymentId: 'deployId1' }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { success: true, deploymentId: 'deployId1' }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { success: false, deploymentId: 'deployId1' }),
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
          a: mockResults('a', { success: true, deploymentId: 'deployId1' }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { success: false, deploymentId: 'deployId1' }),
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
          a: mockResults('a', { success: true, deploymentId: 'deployId1' }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { success: false, deploymentId: 'deployId2' }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { success: false, deploymentId: 'deployId2' }),
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
          a: mockResults('a', { success: true, deploymentId: 'deployId1' }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { success: false, deploymentId: 'deployId1' }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { success: false, deploymentId: 'deployId1' }),
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
