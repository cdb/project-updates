import GitHubProject from 'github-project';
import { Octokit } from '@octokit/rest';
import * as core from '@actions/core';

const octokit = new Octokit({
  auth: core.getInput('token')
});

const organization = core.getInput('organization');
const projectNumber = parseInt(core.getInput('project_number'), 10);
const storageRepo = core.getInput('storage_repo');
const storagePath = core.getInput('storage_path');
const committerName = core.getInput('committer_name');
const committerEmail = core.getInput('committer_email');

async function getOldItems() {
  let items = {};
  let sha = undefined;
  try {
    let { data }: { data: any } = await octokit.rest.repos.getContent({
      owner: organization,
      repo: storageRepo,
      path: storagePath
    });
    if (data.content != 'undefined') {
      items = JSON.parse(Buffer.from(data.content, 'base64').toString());
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
      status: 'status'
    }
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
        assignees: item.content.assignees
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
      message: 'update', // TODO: Better message would be useful
      content: Buffer.from(JSON.stringify(items, null, 2)).toString('base64'),
      sha,
      committer: {
        name: committerName,
        email: committerEmail
      }
    });
  } catch (err) {
    core.error(err);
  }
}

export default { getOldItems, getNewItems, saveItems };
