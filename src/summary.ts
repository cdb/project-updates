import { summary, setFailed } from '@actions/core';
import { debug } from './helpers';
import { NewItemsMap } from './api';

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

async function outputFirstRun(added: NewItemsMap) {
  summary.addRaw('\n## :information_source: First Run Detected');
  summary.addRaw(
    `\n\nImporting ${added.size} issues from the project but will not generate a slack message for this run.`
  );
  await writeSummary();
}

async function outputDiff({ added, removed, changed, closed }) {
  if (added.length > 0) {
    added.forEach((item) => {
      summary.addRaw(
        `- :heavy_plus_sign: [${item.title}](${item.url}) was added to the board\n`
      );
    });
  }

  if (changed.length > 0) {
    changed.forEach((item) => {
      summary.addRaw(
        `- [${item.title}](${item.url}) - ${buildChangeSummary(item)}\n`
      );
    });
  }

  if (closed.length > 0) {
    closed.forEach((item) => {
      summary.addRaw(`- :tada: [${item.title}](${item.url}) was closed!\n`);
    });
  }

  if (removed.length > 0) {
    removed.forEach((item) => {
      summary.addRaw(
        `- :no_entry_sign: [${item.title}](${item.url}) was removed from the board\n`
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

export default {
  outputFirstRun,
  outputDiff
};
