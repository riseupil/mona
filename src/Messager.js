'use strict';

const _ = require('lodash');

const { getLogger } = require('./logger');
const defaultFormatter = require('./templates/default-message-templates');

class Messager {
  constructor(messageSender, messageFormatter) {
    this.formatter = _.merge(defaultFormatter, messageFormatter);
    this.sender = messageSender;
  }

  async sendMessages(messages) {
    await Promise.all(_.map(messages.serviceDeployingAlerts, this._sendDeployAlert.bind(this)));
    await Promise.all(_.map(messages.serviceScalingAlerts, this._sendScalingAlert.bind(this)));
    await Promise.all(_.map(messages.serviceDeployDoneAlerts, this._sendDeployDoneAlert.bind(this)));
    await Promise.all(_.map(messages.serviceDeployTimeoutAlerts, this._sendDeployTimeoutAlert.bind(this)));
    await Promise.all(_.map(messages.serviceRecoverAlerts, this._sendServiceRecoverAlerts.bind(this)));
  }

  async sendMonaDeployedAlert(serviceNames, cluster) {
    getLogger().info(`running for services ${serviceNames} in cluster ${cluster}`);
    await this.sender.send(this.formatter.monitorDeploy(serviceNames, cluster));
  }

  async _sendDeployAlert(serviceState) {
    getLogger().info(`Sending deploy started alert for ${serviceState.service}`, serviceState);
    await this.sender.send(this.formatter.deploy(serviceState));
  }

  async _sendScalingAlert(serviceState) {
    getLogger().info(`Sending deploy re-started alert for ${serviceState.service}`, serviceState);
    await this.sender.send(this.formatter.scale(serviceState));
  }

  async _sendDeployDoneAlert(serviceState) {
    getLogger().info(`Sending deploy done alert for ${serviceState.service}`, serviceState);
    await this.sender.send(this.formatter.deployDone(serviceState));
  }

  async _sendDeployTimeoutAlert(serviceState) {
    getLogger().info(`Sending deploy timeout alert for ${serviceState.service}`, serviceState);
    await this.sender.send(this.formatter.deployTimeout(serviceState));
  }

  async _sendServiceRecoverAlerts(serviceState) {
    getLogger().info(`Sending recovery alert for ${serviceState.service}`, serviceState);
    await this.sender.send(this.formatter.recover(serviceState));
  }
}

module.exports = Messager;
