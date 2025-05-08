import GitHubProject from 'github-project';
import { Octokit } from '@octokit/rest';
import * as core from '@actions/core';
import { debug } from './helpers';
import fetch from 'node-fetch';

const storageOctokit = new Octokit({
  auth: core.getInput('storage_token'),
  fetch: fetch
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
const branchName = core.getInput('branch') || '';

interface OldItems {
  items: any;
  sha: string;
  error?: any;
}
async function getOldItems(): Promise<OldItems> {
  let items = {};
  let sha = undefined;
  try {
    const contentOptions: any = {
      owner: storageOwner,
      repo: storageRepo,
      path: storagePath
    };

    // Only add the branch parameter if a branch name is specified
    if (branchName) {
      contentOptions.ref = branchName;
    }

    let { data }: { data: any } = await storageOctokit.rest.repos.getContent(contentOptions);
    if (data.content != 'undefined') {
      items = JSON.parse(Buffer.from(data.content, 'base64').toString());
    }
    sha = data.sha;
  } catch (err) {
    if (err.status !== 404) {
      core.error(err);
    }
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
  try {
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
      // @ts-ignore
      octokit: new Octokit({
        auth: core.getInput('project_token'),
        fetch: fetch
      }),
      fields: fields
    });

    const quotesRegex = /"([^"]*)"/g;
    let filters: any[] = [];
    if (filterString !== '') {
      filters = filterString.split(',').map(function (f) {
        let [key, value] = f.split(':');
        value = value.replace(quotesRegex, '$1');

        let include = true;
        if (key.startsWith('-')) {
          include = false;
          key = key.substring(1);
        }
        return { key, value, include };
      });
    }

    const items: any[] = await project.items.list();
    let data: NewItemsMap = {};
    itemLoop: for (const item of items) {
      // TODO: We don't get a url for type:DRAFT_ISSUE, should this be all ID? Does that change?
      if (item.content?.id === undefined) {
        continue;
      } else {
        for (const filter of filters) {
          const { key, value, include } = filter;
          if (
            include ? item.fields[key] !== value : item.fields[key] === value
          ) {
            // TODO: Smarter filters, this is only fields
            debug(
              `skipping item due to filter (${key}|${value}|${include}): `,
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
  } catch (err) {
    core.error(err);
    return {};
  }
}

async function saveItems(items, sha) {
  try {
    const commitOptions: any = {
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
    };
    
    // Only add the branch property if a branch name is specified
    if (branchName && branchName.trim() !== '') {
      // Add debug to verify branch name
      debug(`Using branch: "${branchName}" for commit`);
      commitOptions.branch = branchName;
    } else {
      debug('No branch specified, using default branch');
    }

    // Debug the final commit options
    debug('Commit options:', JSON.stringify(commitOptions));
    
    await storageOctokit.rest.repos.createOrUpdateFileContents(commitOptions);
  } catch (err) {
    core.error(err);
    core.setFailed(`Error saving items: ${err}`);
  }
}

export default { getOldItems, getNewItems, saveItems };