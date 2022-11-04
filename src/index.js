import core from "@actions/core";
import github from "@actions/github";
import GitHubProject from "github-project";

const octokit = github.getOctokit(core.getInput("token"));
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
    let contents = await octokit.rest.repos.getContent({
      owner: organization,
      repo: storageRepo,
      path: storagePath,
    });
    core.debug("Got contents: ", contents.data);
    items = JSON.parse(Buffer.from(contents.data.content, "base64"));
    sha = contents.data.sha;
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

  const items = await project.items.list();
  let data = {};
  for (const item of items) {
    data[item.content.url] = {
      title: item.fields.title,
      status: item.fields.status,
      labels: item.content.labels,
      url: item.content.url,
      closed: item.content.closed,
      closedAt: item.content.closedAt,
      merged: item.content.merged,
      assignees: item.content.assignees,
    };
  }
  return data;
}

async function saveItems(items, sha) {
  try {
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: organization,
      repo: storageRepo,
      path: storagePath,
      message: "update",
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

async function outputDiff(prev, next) {
  let added = [];
  let removed = [];
  let changed = [];
  for (const id in prev) {
    if (!(id in next)) {
      removed.push(prev[id]);
    } else if (JSON.stringify(prev[id]) !== JSON.stringify(next[id])) {
      changed.push(next[id]);
    }
  }
  for (const id in next) {
    if (!(id in prev)) {
      added.push(next[id]);
    }
  }

  core.setOutput("added", JSON.stringify(added));
  core.setOutput("removed", JSON.stringify(removed));
  core.setOutput("changed", JSON.stringify(changed));

  await core.summary
    .addHeading("New Issues")
    .addList(added.map((item) => item.title))
    .addHeading("Removed Issues")
    .addList(removed.map((item) => item.title))
    .addHeading("Changed Issues")
    .addList(changed.map((item) => item.title));

  return { added, removed, changed };
}

try {
  let { items: oldItems, sha } = await getOldItems();
  core.debug("oldItems", oldItems);
  core.debug("sha", sha);

  let newItems = await getNewItems();
  core.debug("newItems:", newItems);

  await saveItems(newItems, sha);
  await outputDiff(oldItems, newItems);
} catch (error) {
  core.setFailed(error.message);
}
