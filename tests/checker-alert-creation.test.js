'use strict';

const moment = require('moment');
const { mockResults, checkAlerts } = require('./test-utils');
const Checker = require('../src/Checker');

describe('Deployment checker', () => {
  let checker;

  beforeEach(() => {
    const initialApiResults = {
      a: mockResults('a'),
      b: mockResults('b'),
    };
    checker = new Checker(10, initialApiResults);
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

    test('When scaling is running for a long time, should alert', () => {
      const apiResults = [
        {
          a: mockResults('a', { desiredCount: 2 }),
          b: mockResults('b'),
        },
        {
          a: mockResults('a', { desiredCount: 2, deploymentCreated: moment().subtract(1, 'h') }),
          b: mockResults('b'),
        },
      ];
      const result1 = checker.iterate(apiResults[0]);
      checkAlerts(result1, { serviceScalingAlerts: 1 });

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
