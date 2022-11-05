import { WebClient } from '@slack/web-api';
import * as core from '@actions/core';
import { link } from 'fs';

const slackToken = core.getInput('slack_token');
const channel = core.getInput('slack_channel');

const linkFinderRegex = /\[([^\]]*)\]\(([^\)]*)\)/i;

function cleanMessage(msg: string): string {
  const out = msg.replace(linkFinderRegex, '<$2|$1>');
  console.log('out', out);
  return out;
}

async function sendMessage(msg: string): Promise<void> {
  if (slackToken === '') {
    core.warning('No slack token provided, skipping slack notification');
    return;
  }

  if (msg === '') {
    core.debug('No message provided, skipping slack notification');
    return;
  }

  try {
    const slackWebClient = new WebClient(slackToken);
    const result = await slackWebClient.chat.postMessage({
      text: cleanMessage(msg),
      channel: channel
    });

    if (result.ok) {
      core.info('Slack message sent 🚀');
    } else {
      core.setFailed(`❌ Unable to send Slack message: ${result.error}`);
    }
  } catch (error) {
    core.setFailed(`❌ Action failed with error: ${error}`);
  }
}

export default { sendMessage };
