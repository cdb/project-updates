import { WebClient } from '@slack/web-api';
import * as core from '@actions/core';

const slackToken = core.getInput('slack_token');
const channel = core.getInput('slack_channel');

const linkFinderRegex = /\[(.*?)\]\((.*?)\)/gim;
const headingFinderRegex = /^## (.*)$/gim;

function cleanMessage(msg: string): string {
  let out = msg.replaceAll(linkFinderRegex, '<$2|$1>');
  out = out.replaceAll(headingFinderRegex, '*$1*');
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
