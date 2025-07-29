import { summary, setFailed } from '@actions/core';
import { debug } from './helpers.js';
import { NewItemsMap } from './api.js';

const linkFinderRegex = /\[(.*?)\]\((.*?)\)/gim;
const headingFinderRegex = /^## (.*)$/gim;

function cleanMessage(msg: string): string {
  if (!msg || msg === '') return '';
  let out = msg.replaceAll(linkFinderRegex, '<$2|$1>');
  out = out.replaceAll(headingFinderRegex, '*$1*');
  return out;
}

function getStatusEmoji(fromStatus: string, toStatus: string): string {
  if (toStatus === 'Done' || toStatus === 'Completed') return '✅';
  if (toStatus === 'In Progress' || toStatus === 'Active') return '🚀';
  if (toStatus === 'Blocked' || toStatus === 'On Hold') return '🚧';
  if (toStatus === 'Review' || toStatus === 'Testing') return '👀';
  if (toStatus === 'Todo' || toStatus === 'Backlog') return '📋';
  return '🔄';
}

function buildContextualMessage(item) {
  let messages = [];
  
  if (item.previous_title) {
    messages.push(`📝 Renamed from "${item.previous_title}"`);
  }
  
  if (item.status) {
    const emoji = getStatusEmoji(item.status.prev, item.status.next);
    const fromStatus = item.status.prev;
    const toStatus = item.status.next;
    
    if (toStatus === 'Done' || toStatus === 'Completed') {
      messages.push(`${emoji} Completed`);
    } else if (toStatus === 'In Progress' || toStatus === 'Active') {
      messages.push(`${emoji} Work started`);
    } else if (toStatus === 'Blocked' || toStatus === 'On Hold') {
      messages.push(`${emoji} Now blocked`);
    } else if (toStatus === 'Review' || toStatus === 'Testing') {
      messages.push(`${emoji} Ready for review`);
    } else {
      messages.push(`${emoji} Moved to ${toStatus}`);
    }
  }
  
  if (item.labels_added) {
    const priorityLabels = item.labels_added.filter(l => l.toLowerCase().includes('priority') || l.toLowerCase().includes('urgent'));
    const otherLabels = item.labels_added.filter(l => !priorityLabels.includes(l));
    
    if (priorityLabels.length > 0) {
      messages.push(`🔥 Marked as ${priorityLabels.join(', ')}`);
    }
    if (otherLabels.length > 0) {
      messages.push(`🏷️ Tagged: ${otherLabels.join(', ')}`);
    }
  }
  
  if (item.labels_removed) {
    messages.push(`🏷️ Removed tags: ${item.labels_removed.join(', ')}`);
  }
  
  if (item.assignees_added) {
    const assigneeList = item.assignees_added.join(', ');
    messages.push(`👨‍💻 ${assigneeList} picked this up`);
  }
  
  if (item.assignees_removed) {
    messages.push(`👋 Unassigned from ${item.assignees_removed.join(', ')}`);
  }
  
  if (item.closed) {
    const emoji = item.closed.next ? '🎉' : '📤';
    messages.push(item.closed.next ? `${emoji} Closed and completed` : `${emoji} Reopened`);
  }
  
  if (item.merged) {
    const emoji = item.merged.next ? '🎉' : '🔄';
    messages.push(item.merged.next ? `${emoji} Merged` : `${emoji} Unmerged`);
  }
  
  debug('contextual messages', messages);
  return messages.join(' • ');
}

async function outputFirstRun(added: NewItemsMap) {
  summary.addRaw('\n## :information_source: First Run Detected');
  summary.addRaw(
    `\n\nImporting ${added.size} issues from the project but will not generate output for this run.`
  );
  await writeSummary();
}

function groupChangesByPerson(changes) {
  const byPerson = {};
  
  changes.forEach((item) => {
    if (item.assignees_added) {
      item.assignees_added.forEach(assignee => {
        if (!byPerson[assignee]) byPerson[assignee] = [];
        byPerson[assignee].push({ ...item, changeType: 'picked_up' });
      });
    }
    
    // If no specific assignee changes, group under "Team Updates"
    if (!item.assignees_added && !item.assignees_removed) {
      if (!byPerson['Team Updates']) byPerson['Team Updates'] = [];
      byPerson['Team Updates'].push(item);
    }
  });
  
  return byPerson;
}

function addCadenceInsights(added, changed, closed) {
  const totalMovement = added.length + changed.length + closed.length;
  const completedCount = closed.length + changed.filter(c => 
    c.status && (c.status.next === 'Done' || c.status.next === 'Completed')
  ).length;
  
  if (totalMovement >= 3) {
    summary.addRaw(`📈 **${totalMovement} items moved forward today**\n\n`);
  }
  
  if (completedCount >= 2) {
    summary.addRaw(`🎉 **${completedCount} items completed**\n\n`);
  }
}

async function outputDiff({ added, removed, changed, closed }) {
  const hasChanges = added.length + removed.length + changed.length + closed.length > 0;
  
  if (!hasChanges) {
    summary.addRaw(
      '\n## No Changes\n\nNo changes were detected in the project.'
    );
    await writeSummary();
    return cleanMessage(summary.stringify());
  }

  // Add cadence insights at the top
  addCadenceInsights(added, changed, closed);

  // Group work started items
  const workStarted = changed.filter(item => 
    item.status && (item.status.next === 'In Progress' || item.status.next === 'Active')
  );
  
  if (workStarted.length > 0) {
    summary.addRaw('🚀 **Work Started**\n');
    workStarted.forEach((item) => {
      summary.addRaw(`- [${item.title}](${item.url})\n`);
    });
    summary.addRaw('\n');
  }

  // Group completed items (both closed and status completed)
  const completedItems = [...closed];
  const statusCompleted = changed.filter(item => 
    item.status && (item.status.next === 'Done' || item.status.next === 'Completed')
  );
  completedItems.push(...statusCompleted);
  
  if (completedItems.length > 0) {
    summary.addRaw('✅ **Completed**\n');
    completedItems.forEach((item) => {
      summary.addRaw(`- [${item.title}](${item.url})\n`);
    });
    summary.addRaw('\n');
  }

  // Group new items
  if (added.length > 0) {
    summary.addRaw('➕ **Added to Board**\n');
    added.forEach((item) => {
      summary.addRaw(`- [${item.title}](${item.url})\n`);
    });
    summary.addRaw('\n');
  }

  // Group other updates
  const otherUpdates = changed.filter(item => 
    !(item.status && (item.status.next === 'In Progress' || item.status.next === 'Active')) &&
    !(item.status && (item.status.next === 'Done' || item.status.next === 'Completed'))
  );
  
  if (otherUpdates.length > 0) {
    summary.addRaw('🔄 **Other Updates**\n');
    otherUpdates.forEach((item) => {
      summary.addRaw(
        `- [${item.title}](${item.url}) - ${buildContextualMessage(item)}\n`
      );
    });
    summary.addRaw('\n');
  }

  // Group removed items
  if (removed.length > 0) {
    summary.addRaw('❌ **Removed from Board**\n');
    removed.forEach((item) => {
      summary.addRaw(`- [${item.title}](${item.url})\n`);
    });
  }

  const summaryWithoutNull = summary.stringify();
  await writeSummary();
  return cleanMessage(summaryWithoutNull);
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
