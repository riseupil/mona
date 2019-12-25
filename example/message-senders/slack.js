'use strict';

const request = require('request-promise-native');

const slackChannel = 'https://hooks.slack.com/services/XXXXXXXXX/YYYYYYYYY/ZZZZZZZZZZZZZZZZZZZZZZZZ';

async function send(text) {
  return await request({
    method: 'post',
    url: slackChannel,
    json: true,
    body: { text },
  });
}

module.exports = {
  send,
};

