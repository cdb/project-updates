import { summary, setFailed } from '@actions/core';
import api from './api';
import outputs from './outputs';
import { debug } from './helpers';
import comparator from './comparator';

function buildChangeSummary(item) {
  // TODO: Probably better ways to describe each change type
  let summaries = [];
  if (item.previous_title) {
    summaries.push(`Previous title: ${item.title.prev}`);
  }
  if (item.status) {
    summaries.push(`Status: ${item.status.prev} -> ${item.status.next}`);
  }
  if (item.labels_added) {
    summaries.push(`Added labels: ${item.labels_added.join(', ')}`);
  }
  if (item.labels_removed) {
    summaries.push(`Removed labels: ${item.labels_removed.join(', ')}`);
  }
  if (item.assignees_added) {
    summaries.push(`Assigned to: ${item.assignees_added.join(', ')}`);
  }
  if (item.assignees_removed) {
    summaries.push(`Removed assignees: ${item.assignees_removed.join(', ')}`);
  }
  if (item.closed) {
    summaries.push(`Closed: ${item.closed.prev} -> ${item.closed.next}`);
  }
  if (item.merged) {
    summaries.push(`Merged: ${item.merged.prev} -> ${item.merged.next}`);
  }
  debug('summaries', summaries);
  return summaries.join(', ');
}

async function outputDiffToSummary({ added, removed, changed }) {
  if (added.length > 0) {
    summary
      .addHeading('New Issues')
      .addList(added.map((item) => `<a href="${item.url}">${item.title}</a>`));
  }

  if (removed.length > 0) {
    summary
      .addHeading('Removed Issues')
      .addList(
        removed.map((item) => `<a href="${item.url}">${item.title}</a>`)
      );
  }

  if (changed.length > 0) {
    summary
      .addHeading('Changed Issues')
      .addList(
        changed.map(
          (item) =>
            `<a href="${item.url}">${item.title}</a> - ${buildChangeSummary(
              item
            )}`
        )
      );
  }

  if (added.length + removed.length + changed.length === 0) {
    summary
      .addHeading('No Changess')
      .addRaw('\nNo changes were detected in the project.');
  }

  const pathFromEnv = process.env['GITHUB_STEP_SUMMARY'];
  if (pathFromEnv) {
    summary.write();
  } else {
    debug('would write summary', summary.stringify());
  }
}

try {
  let { items: oldItems, sha } = await api.getOldItems();
  debug('oldItems', oldItems);

  let newItems = await api.getNewItems();
  debug('newItems:', newItems);

  await api.saveItems(newItems, sha);
  let diff = comparator.diff(oldItems, newItems);

  outputs.diff(diff);
  await outputDiffToSummary(diff);
} catch (error) {
  setFailed(error.message);
}
