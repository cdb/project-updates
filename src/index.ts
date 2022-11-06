import { summary, setFailed } from '@actions/core';
import api, { NewItemsMap } from './api';
import outputs from './outputs';
import { debug } from './helpers';
import slack from './slack';
import comparator from './comparator';

function buildChangeSummary(item) {
  // TODO: Probably better ways to describe each change type
  let summaries = [];
  if (item.previous_title) {
    summaries.push(`Previous title: ${item.title.prev}`);
  }
  if (item.status) {
    const extra = item.status.next == 'Done' ? ' :tada:' : '';
    summaries.push(
      `Status: \`${item.status.prev}\` -> \`${item.status.next}\`${extra}`
    );
  }
  if (item.labels_added) {
    summaries.push(
      `Added labels: ${item.labels_added.map((l) => `\`${l}\``).join(', ')}`
    );
  }
  if (item.labels_removed) {
    summaries.push(
      `Removed labels: ${item.labels_removed.map((l) => `\`${l}\``).join(', ')}`
    );
  }
  if (item.assignees_added) {
    summaries.push(
      `Assigned to: ${item.assignees_added.map((l) => `\`${l}\``).join(', ')}`
    );
  }
  if (item.assignees_removed) {
    summaries.push(
      `Removed assignees: ${item.assignees_removed
        .map((l) => `\`${l}\``)
        .join(', ')}`
    );
  }
  if (item.closed) {
    const extra = item.closed.next ? ':partying_face:' : '';
    summaries.push(
      `Closed: \`${item.closed.prev}\` -> \`${item.closed.next}\`${extra}`
    );
  }
  if (item.merged) {
    const extra = item.merged.next ? ':partying_face:' : '';
    summaries.push(
      `Merged: \`${item.merged.prev}\` -> \`${item.merged.next}\`${extra}`
    );
  }
  debug('summaries', summaries);
  return summaries.join('. ');
}

async function outputFirstRunSummary(added: NewItemsMap) {
  summary.addRaw('\n## :information_source: First Run Detected');
  summary.addRaw(
    `\n\nImporting #{added.length} issues from the project but will not generate a slack message for this run.`
  );
  await writeSummary();
}

async function outputDiffToSummary({ added, removed, changed }) {
  if (added.length > 0) {
    summary.addRaw('\n## :heavy_plus_sign: New Issues\n\n');
    added.forEach((item) => {
      summary.addRaw(`- [${item.title}](${item.url})\n`);
    });
  }

  if (removed.length > 0) {
    summary.addRaw('\n## :heavy_minus_sign: Removed Issues\n\n');
    removed.forEach((item) => {
      summary.addRaw(`- [${item.title}](${item.url})\n`);
    });
  }

  if (changed.length > 0) {
    summary.addRaw('\n## :curly_loop: Changed Issues\n\n');
    changed.forEach((item) => {
      summary.addRaw(
        `- [${item.title}](${item.url}) - ${buildChangeSummary(item)}\n`
      );
    });
  }

  const summaryWithoutNull = summary.stringify();

  if (added.length + removed.length + changed.length === 0) {
    summary.addRaw(
      '\n## No Changes\n\nNo changes were detected in the project.'
    );
  }

  await writeSummary();
  return summaryWithoutNull;
}

async function writeSummary() {
  const pathFromEnv = process.env['GITHUB_STEP_SUMMARY'];
  if (pathFromEnv) {
    summary.write();
  } else {
    debug('would write summary', summary.stringify());
  }
}

async function run(): Promise<void> {
  try {
    let isFirstRun = false;
    let { items: oldItems, sha, error } = await api.getOldItems();
    if (error) {
      debug('error', error);
      if (error.status === 404) {
        debug('first run');
        isFirstRun = true;
      }
    } else {
      debug('oldItems', oldItems);
    }

    let newItems = await api.getNewItems();
    debug('newItems:', newItems);

    // await api.saveItems(newItems, sha);
    let diff = comparator.diff(oldItems, newItems);

    // Send a simple summary and return
    if (isFirstRun) {
      await outputFirstRunSummary(newItems);
      return;
    }

    // It's not the first run, lets diff it, and send real summaries
    outputs.diff(diff);
    const msg = await outputDiffToSummary(diff);
    slack.sendMessage(msg);
  } catch (error) {
    setFailed(error.message);
  }
}

run();
