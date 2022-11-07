import GitHubProject from 'github-project';
import { Octokit } from '@octokit/rest';
import * as core from '@actions/core';
import { debug } from './helpers';

const storageOctokit = new Octokit({
  auth: core.getInput('storage_token')
});

const projectOctokit = new Octokit({
  auth: core.getInput('project_token')
});

const projectOrganization = core.getInput('project_organization');
const projectNumber = parseInt(core.getInput('project_number'), 10);
const storageNWO = core.getInput('storage_repository');
const [storageOwner, storageRepo] = storageNWO.split('/');
const storagePath = core.getInput('storage_path');
const committerName = core.getInput('committer_name');
const committerEmail = core.getInput('committer_email');
const customFields = core.getInput('custom_fields');
const filterString = core.getInput('filter');

interface OldItems {
  items: any;
  sha: string;
  error?: any;
}
async function getOldItems(): Promise<OldItems> {
  let items = {};
  let sha = undefined;
  try {
    let { data }: { data: any } = await storageOctokit.rest.repos.getContent({
      owner: storageOwner,
      repo: storageRepo,
      path: storagePath
    });
    if (data.content != 'undefined') {
      items = JSON.parse(Buffer.from(data.content, 'base64').toString());
    }
    sha = data.sha;
  } catch (err) {
    core.error(err);
    return { items: [], sha: '', error: err };
  }
  return { items, sha };
}

export interface NewItemsMap {
  [key: string]: NewItem;
}

export interface NewItem {
  type: string;
  title: string;
  status: string;
  labels: string;
  url: string;
  closed: string;
  merged: string;
  assignees: string;
}

async function getNewItems(): Promise<NewItemsMap> {
  let fields = { status: 'status' };
  if (customFields) {
    fields = customFields.split(',').reduce((acc, field) => {
      acc[field] = field;
      return acc;
    }, fields);
  }
  const project = new GitHubProject({
    owner: projectOrganization,
    number: projectNumber,
    octokit: projectOctokit,
    fields: fields
  });

  const quotesRegex = /"([^"]*)"/g;
  const filters = filterString.split(',').map(function (f) {
    let [key, value] = f.split(':');
    value = value.replace(quotesRegex, '$1');
    return { key, value };
  });

  const items: any[] = await project.items.list();
  let data: NewItemsMap = {};
  itemLoop: for (const item of items) {
    // TODO: We don't get a url for type:DRAFT_ISSUE, should this be all ID? Does that change?
    if (item.content?.id === undefined) {
      continue;
    } else {
      for (const filter of filters) {
        const { key: filterKey, value: filterValue } = filter;
        if (item.fields[filterKey] !== filterValue) {
          // TODO: Smarter filters, this is only fields
          debug(
            `skipping item due to filter (${filterKey}|${filterValue}): `,
            item
          );
          continue itemLoop;
        }
      }

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
    await storageOctokit.rest.repos.createOrUpdateFileContents({
      owner: storageOwner,
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
