import * as core from '@actions/core';
import GitHubProject from "github-project";
import { difference } from "lodash";

import { Octokit } from '@octokit/rest';
const octokit = new Octokit({
	auth: core.getInput("token"),
});
const organization = core.getInput("organization");
const projectNumber = parseInt(core.getInput("project_number"), 10);
const storageRepo = core.getInput("storage_repo");
const storagePath = core.getInput("storage_path");
const committerName = core.getInput("committer_name");
const committerEmail = core.getInput("committer_email");

async function getOldItems() {
  let items = {};
  let sha = undefined;
  try {
    let { data }: { data:any } = await octokit.rest.repos.getContent({
      owner: organization,
      repo: storageRepo,
      path: storagePath,
    });
    if (data.content != "undefined") {
      items = JSON.parse(Buffer.from(data.content, "base64").toString());
    }
    sha = data.sha;
  } catch (err) {
    core.error(err);
  }
  return { items, sha };
}

async function getNewItems() {
  const project = new GitHubProject({
    owner: organization,
    number: projectNumber,
    octokit: octokit,
    fields: {
      status: "status",
    },
  });

  const items: any[] = await project.items.list();
  let data: any = {};
  for (const item of items) {
    // TODO: We don't get a url for type:DRAFT_ISSUE, should this be all ID? Does that change?
    if (item.content?.id === undefined) {
      continue;
    } else {
      data[item.content.id] = {
        type: item.type,
        title: item.fields.title,
        status: item.fields.status,
        labels: item.content.labels,
        url: item.content.url,
        closed: item.content.closed,
        merged: item.content.merged,
        assignees: item.content.assignees,
      };
    }
  }
  return data;
}

async function saveItems(items, sha) {
  try {
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: organization,
      repo: storageRepo,
      path: storagePath,
      message: "update", // TODO: Better message would be useful
      content: Buffer.from(JSON.stringify(items, null, 2)).toString("base64"),
      sha,
      committer: {
        name: committerName,
        email: committerEmail,
      },
    });
  } catch (err) {
    core.error(err);
  }
}

function buildChanges(prev, next) {
  let changes: any = { title: next.title, url: next.url };
  if (prev.title !== next.title) {
    changes.previous_title = prev.title;
  }

  if (prev.status !== next.status) {
    changes.status = { prev: prev.status, next: next.status };
  }

  let added_labels = difference(next.labels, prev.labels);
  if (added_labels.length > 0) {
    changes.labels_added = added_labels;
  }

  let remove_labels = difference(prev.labels, next.labels);
  if (remove_labels.length > 0) {
    changes.labels_removed = remove_labels;
  }

  let added_assignees = difference(next.assignees, prev.assignees);
  if (added_assignees.length > 0) {
    changes.assignees_added = added_assignees;
  }

  let removed_assignees = difference(prev.assignees, next.assignees);
  if (removed_assignees.length > 0) {
    changes.assignees_removed = removed_assignees;
  }

  if (prev.closed !== next.closed) {
    changes.closed = { prev: prev.closed, next: next.closed };
  }
  if (prev.merged !== next.merged) {
    changes.merged = { prev: prev.merged, next: next.merged };
  }

  debug("changes", changes);
  return changes;
}

function calculateDiff(prev, next) {
  let added = []; // TODO: Handle type:DRAFT_ISSUE->type:ISSUE as a change not add/drop
  let removed = [];
  let changed = [];
  for (const id in prev) {
    if (!(id in next)) {
      removed.push(prev[id]);
    } else if (JSON.stringify(prev[id]) !== JSON.stringify(next[id])) {
      changed.push(buildChanges(prev[id], next[id]));
    }
  }
  for (const id in next) {
    if (!(id in prev)) {
      added.push(next[id]);
    }
  }

  return { added, removed, changed };
}

function outputDiffAsOutput({ added, removed, changed }) {
  core.setOutput("added", JSON.stringify(added));
  core.setOutput("removed", JSON.stringify(removed));
  core.setOutput("changed", JSON.stringify(changed));
}

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
    summaries.push(`Added labels: ${item.labels_added.join(", ")}`);
  }
  if (item.labels_removed) {
    summaries.push(`Removed labels: ${item.labels_removed.join(", ")}`);
  }
  if (item.assignees_added) {
    summaries.push(`Assigned to: ${item.assignees_added.join(", ")}`);
  }
  if (item.assignees_removed) {
    summaries.push(`Removed assignees: ${item.assignees_removed.join(", ")}`);
  }
  if (item.closed) {
    summaries.push(`Closed: ${item.closed.prev} -> ${item.closed.next}`);
  }
  if (item.merged) {
    summaries.push(`Merged: ${item.merged.prev} -> ${item.merged.next}`);
  }
  debug("summaries", summaries);
  return summaries.join(", ");
}

async function outputDiffToSummary({ added, removed, changed }) {
  if (added.length > 0) {
    core.summary
      .addHeading("New Issues")
      .addList(added.map((item) => `<a href="${item.url}">${item.title}</a>`));
  }

  if (removed.length > 0) {
    core.summary
      .addHeading("Removed Issues")
      .addList(
        removed.map((item) => `<a href="${item.url}">${item.title}</a>`)
      );
  }

  if (changed.length > 0) {
    core.summary
      .addHeading("Changed Issues")
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
    core.summary
      .addHeading("No Changess")
      .addRaw("\nNo changes were detected in the project.");
  }

  const pathFromEnv = process.env["GITHUB_STEP_SUMMARY"];
  if (pathFromEnv) {
    core.summary.write();
  } else {
    debug("would write summary", core.summary.stringify());
  }
}

try {
  let { items: oldItems, sha } = await getOldItems();
  debug("oldItems", oldItems);

  let newItems = await getNewItems();
  debug("newItems:", newItems);

  await saveItems(newItems, sha);
  let diff = calculateDiff(oldItems, newItems);

  outputDiffAsOutput(diff);
  await outputDiffToSummary(diff);
} catch (error) {
  core.setFailed(error.message);
}

function debug(name, obj) {
  core.debug(`${name}: ${JSON.stringify(obj)}`);
}
