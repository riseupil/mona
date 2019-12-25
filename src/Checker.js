'use strict';

const moment = require('moment');
const _ = require('lodash');

const { getLogger } = require('./logger');
const { DEPLOYMENT_STATES } = require('./consts');

class Checker {
  constructor(secondsUntilAlert) {
    this.secondsUntilAlert = secondsUntilAlert;
    this.deploymentTimeoutAlerted = {};
    this.deploymentInProgress = {};
    this.lastDeploymentDone = {};
    this.currentTaskDef = {};
  }

  iterate(serviceStates) {
    const serviceNames = _.keys(serviceStates);
    const serviceDeployStates = this._getDeploymentStates(serviceNames, serviceStates);

    const serviceDeployingAlerts = _.filter(_.map(serviceNames, service => this._checkDeploymentStartedAlert(service, serviceStates[service], serviceDeployStates[service]))); // eslint-disable-line max-len
    const serviceScalingAlerts = _.filter(_.map(serviceNames, service => this._checkScalingAlert(service, serviceStates[service], serviceDeployStates[service]))); // eslint-disable-line max-len
    const serviceDeployDoneAlerts = _.filter(_.map(serviceNames, service => this._checkDeploymentDoneAlert(service, serviceStates[service], serviceDeployStates[service]))); // eslint-disable-line max-len
    const serviceDeployTimeoutAlerts = _.filter(_.map(serviceNames, service => this._checkDeploymentTimeoutAlert(service, serviceStates[service], serviceDeployStates[service]))); // eslint-disable-line max-len

    this._updateTaskDefs(serviceNames, serviceStates);

    return {
      serviceDeployStates,
      serviceDeployingAlerts,
      serviceScalingAlerts,
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
    if (newState.success) {
      return DEPLOYMENT_STATES.STABLE;
    }
    if (this._isScaling(service, newState)) {
      return DEPLOYMENT_STATES.SCALING;
    }
    return DEPLOYMENT_STATES.DEPLOYING;
  }

  _isScaling(service, state) {
    return this._isCurrentTaskDef(service, state.taskDef) && this._deploymentFinished(service, state.deploymentId);
  }

  _isCurrentTaskDef(service, taskDef) {
    return this.currentTaskDef[service] === taskDef;
  }

  _deploymentFinished(service, deploymentId) {
    return this.lastDeploymentDone[service] === deploymentId;
  }

  _deploymentInProgress(service, deploymentId) {
    return this.deploymentInProgress[service] === deploymentId;
  }

  _updateTaskDefs(serviceNames, serviceStates) {
    _.forEach(serviceNames, service => {
      this.currentTaskDef[service] = serviceStates[service].taskDef;
      if (serviceStates[service].success) {
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
    if (deployState === DEPLOYMENT_STATES.SCALING && !this._deploymentInProgress(service, serviceState.deploymentId)) {
      this.deploymentInProgress[service] = serviceState.deploymentId;
      this.lastDeploymentDone[service] = null;
      return serviceState;
    }
    return null;
  }

  _checkDeploymentDoneAlert(service, serviceState, deployState) {
    if (deployState === DEPLOYMENT_STATES.STABLE) {
      if (this._deploymentInProgress(service, serviceState.deploymentId)) {
        this.deploymentInProgress[service] = null;
        this.lastDeploymentDone[service] = serviceState.deploymentId;
        return serviceState;
      }
    }
    return null;
  }

  _checkDeploymentTimeoutAlert(service, serviceState, deployState) {
    if (deployState === DEPLOYMENT_STATES.DEPLOYING) {
      const deployStartTime = moment(serviceState.deploymentCreated);
      const deploymentTime = Math.floor(moment().diff(deployStartTime) / 1000);

      if (deploymentTime > this.secondsUntilAlert) {
        if (this.deploymentTimeoutAlerted[service] !== serviceState.deploymentId) {
          getLogger().info(`Detected deploy timeout for service ${serviceState.service}
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
