'use strict';

module.exports = {
  deploy: serviceState => `:arrows_clockwise: \`${serviceState.service}\` deployment started with task definition \`${serviceState.taskDef}\``,
  scale: serviceState => {
    if (serviceState.runningCount === 0) {
      return `:warning: \`${serviceState.service}\` scaling event started with \`0\` running tasks (desired: \`${serviceState.desiredCount}\`). This is usually an error! Please check the logs`;
    }
    return `:arrow_up_down: \`${serviceState.service}\` scaling event started - scaling to \`${serviceState.desiredCount}\` instances. Currently: \`${serviceState.runningCount}\``
  },
  deployDone: serviceState => `:white_check_mark: \`${serviceState.service}\` deployment done with \`${serviceState.runningCount}\` instances and task definition \`${serviceState.taskDef}\``,
  deployTimeout: serviceState => `:thinking_face: \`${serviceState.service}\` deployment is taking a very long time`,
  monitorDeploy: (serviceNames, cluster) => `:white_check_mark: \`Mona\` is deployed and monitoring ECS cluster \`${cluster}\``
};
