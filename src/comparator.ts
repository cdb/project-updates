import { difference } from 'lodash';
import { debug } from './helpers';

interface Change {
  title: string;
  url: string;
  previous_title?: string;
  status?: { prev: string; next: string };
  labels_added?: string[];
  labels_removed?: string[];
  assignees_added?: string[];
  assignees_removed?: string[];
  closed?: { prev: boolean; next: boolean };
  merged?: { prev: boolean; next: boolean };
}

function buildChanges(prev, next) {
  let changes: Change = { title: next.title, url: next.url };
  if (prev.title !== next.title) {
    changes.previous_title = prev.title;
  }

  if (prev.status !== next.status) {
    changes.status = { prev: prev.status, next: next.status };
  }

  let added_labels: string[] = difference(next.labels, prev.labels);
  if (added_labels.length > 0) {
    changes.labels_added = added_labels;
  }

  let removed_labels: string[] = difference(prev.labels, next.labels);
  if (removed_labels.length > 0) {
    changes.labels_removed = removed_labels;
  }

  let added_assignees: string[] = difference(next.assignees, prev.assignees);
  if (added_assignees.length > 0) {
    changes.assignees_added = added_assignees;
  }

  let removed_assignees: string[] = difference(prev.assignees, next.assignees);
  if (removed_assignees.length > 0) {
    changes.assignees_removed = removed_assignees;
  }

  if (prev.closed !== next.closed) {
    changes.closed = { prev: prev.closed, next: next.closed };
  }
  if (prev.merged !== next.merged) {
    changes.merged = { prev: prev.merged, next: next.merged };
  }

  debug('changes', changes);
  return changes;
}

function diff(prev, next) {
  let added = []; // TODO: Handle type:DRAFT_ISSUE->type:ISSUE as a change not add/drop
  let removed = [];
  let closed = [];
  let changed = [];
  for (const id in prev) {
    if (!(id in next)) {
      removed.push(prev[id]);
    } else if (JSON.stringify(prev[id]) !== JSON.stringify(next[id])) {
      if (next[id].closed) {
        closed.push(next[id]);
      } else {
        changed.push(buildChanges(prev[id], next[id]));
      }
    }
  }
  for (const id in next) {
    if (!(id in prev)) {
      added.push(next[id]);
    }
  }

  return { added, removed, changed, closed };
}

export default { diff };
