'use strict';

const moment = require('moment');
const _ = require('lodash');

const { DEPLOYMENT_STATES } = require('./consts');

class Checker {
  constructor(secondsUntilAlert, initialServiceStates) {
    this.secondsUntilAlert = secondsUntilAlert;
    this.deploymentTimeoutAlerted = {};
    this.deploymentInProgress = {};
    this.lastDeploymentDone = {};
    this.currentTaskDef = {};
    this.currentDesiredCount = {};

    const serviceNames = _.keys(initialServiceStates);
    this._updateTaskDefs(serviceNames, initialServiceStates, true);
  }

  iterate(serviceStates) {
    const serviceNames = _.keys(serviceStates);
    const serviceDeployStates = this._getDeploymentStates(serviceNames, serviceStates);

    const serviceDeployingAlerts = _.filter(_.map(serviceNames, service => this._checkDeploymentStartedAlert(service, serviceStates[service], serviceDeployStates[service]))); // eslint-disable-line max-len
    const serviceScalingAlerts = _.filter(_.map(serviceNames, service => this._checkScalingAlert(service, serviceStates[service], serviceDeployStates[service]))); // eslint-disable-line max-len
    const serviceRecoverAlerts = _.filter(_.map(serviceNames, service => this._checkRecoverAlert(service, serviceStates[service], serviceDeployStates[service]))); // eslint-disable-line max-len
    const serviceDeployDoneAlerts = _.filter(_.map(serviceNames, service => this._checkDeploymentDoneAlert(service, serviceStates[service], serviceDeployStates[service]))); // eslint-disable-line max-len
    const serviceDeployTimeoutAlerts = _.filter(_.map(serviceNames, service => this._checkDeploymentTimeoutAlert(service, serviceStates[service], serviceDeployStates[service]))); // eslint-disable-line max-len

    this._updateTaskDefs(serviceNames, serviceStates);

    return {
      serviceDeployStates,
      serviceDeployingAlerts,
      serviceScalingAlerts,
      serviceRecoverAlerts,
      serviceDeployDoneAlerts,
      serviceDeployTimeoutAlerts,
    };
  }

  _getDeploymentStates(serviceNames, newStates) {
    const serviceStates = {};
    _.forEach(serviceNames, service => {
      serviceStates[service] = this._serviceDeploymentState(newStates[service], service);
    });
    return serviceStates;
  }

  _serviceDeploymentState(newState, service) {
    if (this._isNewDeployment(service, newState)) {
      if (this._isDeploymentDone(service, newState)) {
        return DEPLOYMENT_STATES.STABLE;
      }

      return DEPLOYMENT_STATES.DEPLOYING;
    }

    if (this._isStable(service, newState)) {
      return DEPLOYMENT_STATES.STABLE;
    }

    if (this._updatedDesiredCount(service, newState)) {
      return DEPLOYMENT_STATES.SCALING;
    }

    return DEPLOYMENT_STATES.RECOVER;
  }

  _isStable(service, state) {
    return state.deploymentRunningCount === state.desiredCount;
  }

  _isNewDeployment(service, state) {
    return !this._deploymentFinished(service, state.deploymentId);
  }

  _isDeploymentDone(service, state) {
    return state.desiredCount === state.deploymentRunningCount;
  }

  _updatedDesiredCount(service, state) {
    return this.currentDesiredCount[service] !== state.desiredCount;
  }

  _deploymentFinished(service, deploymentId) {
    return this.lastDeploymentDone[service] === deploymentId;
  }

  _deploymentInProgress(service, deploymentId) {
    return this.deploymentInProgress[service] === deploymentId;
  }

  _updateTaskDefs(serviceNames, serviceStates, firstRun=false) {
    _.forEach(serviceNames, service => {
      this.currentTaskDef[service] = serviceStates[service].taskDef;
      this.currentDesiredCount[service] = serviceStates[service].desiredCount;

      if (firstRun || this._isStable(service, serviceStates[service])) {
        this.lastDeploymentDone[service] = serviceStates[service].deploymentId;
      }
    });
  }

  _checkDeploymentStartedAlert(service, serviceState, deployState) {
    if (deployState === DEPLOYMENT_STATES.DEPLOYING && !this._deploymentInProgress(service, serviceState.deploymentId)) {
      this.deploymentInProgress[service] = serviceState.deploymentId;
      this.lastDeploymentDone[service] = null;
      this.currentTaskDef[service] = serviceState.taskDef;
      return serviceState;
    }
    return null;
  }

  _checkScalingAlert(service, serviceState, deployState) {
    if (deployState === DEPLOYMENT_STATES.SCALING) {
      this.deploymentInProgress[service] = serviceState.deploymentId;
      this.currentDesiredCount[service] = serviceState.desiredCount;
      this.lastDeploymentDone[service] = null;
      return serviceState;
    }
    return null;
  }

  _checkRecoverAlert(service, serviceState, deployState) {
    if (deployState === DEPLOYMENT_STATES.RECOVER && !this._deploymentInProgress(service, serviceState.deploymentId)) {
      this.deploymentInProgress[service] = serviceState.deploymentId;
      this.lastDeploymentDone[service] = null;
      this.deploymentTimeoutAlerted[service] = serviceState.deploymentId;
      return serviceState;
    }
    return null;
  }

  _checkDeploymentDoneAlert(service, serviceState, deployState) {
    if (deployState === DEPLOYMENT_STATES.STABLE && this._deploymentInProgress(service, serviceState.deploymentId)) {
      this.deploymentInProgress[service] = null;
      this.lastDeploymentDone[service] = serviceState.deploymentId;
      return serviceState;
    }
    return null;
  }

  _checkDeploymentTimeoutAlert(service, serviceState, deployState) {
    if (deployState === DEPLOYMENT_STATES.DEPLOYING) {
      const deployStartTime = moment(serviceState.deploymentCreated);
      const deploymentTime = Math.floor(moment().diff(deployStartTime) / 1000);

      if (deploymentTime > this.secondsUntilAlert) {
        if (this.deploymentTimeoutAlerted[service] !== serviceState.deploymentId) {
          console.log(`Detected deploy timeout for service ${serviceState.service}
timeout is ${this.secondsUntilAlert} seconds and running for ${deploymentTime} seconds`);
          this.deploymentTimeoutAlerted[service] = serviceState.deploymentId;
          return serviceState;
        }
      }
    }
    return null;
  }
}

module.exports = Checker;
