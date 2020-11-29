'use strict';

const { DEPLOYMENT_STATES } = require('../src/consts');
const { mockResults } = require('./test-utils');
const Checker = require('../src/Checker');
const { loggerInit } = require('../src/logger');

loggerInit(console);

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

    test('If a task crashed while another deployment was active, state is still RECOVER', () => {
      const result = checker.iterate({ a: mockResults('a', { deploymentRunningCount: 0 }) });
      expect(result.serviceDeployStates.a).toEqual(DEPLOYMENT_STATES.RECOVER);
    });
  });
});
