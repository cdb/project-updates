import githubProjectPkg from 'github-project';
import { Octokit } from '@octokit/rest';
import * as core from '@actions/core';
import { debug } from './helpers.js';
import nodeFetch from 'node-fetch';

const GitHubProject = githubProjectPkg;
const fetch = nodeFetch;

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

interface DataWithMetadata {
  _metadata: {
    version: string;
    lastUpdate: string | null;
    runId: string | null;
    previousUpdate: string | null;
  };
  items: any;
}

interface OldItems {
  items: any;
  sha: string;
  error?: any;
  metadata?: DataWithMetadata['_metadata'];
}
function migrateToNewFormat(data: any): DataWithMetadata {
  // Check if it's already new format
  if (data._metadata && data.items) {
    return data as DataWithMetadata;
  }
  
  // It's old format - migrate it
  debug('Migrating old format data to new format');
  return {
    _metadata: {
      version: "2.0",
      lastUpdate: null,
      runId: null,
      previousUpdate: null
    },
    items: data
  };
}

async function getOldItems(): Promise<OldItems> {
  let items = {};
  let metadata = undefined;
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
      const rawData = JSON.parse(Buffer.from(data.content, 'base64').toString());
      const migratedData = migrateToNewFormat(rawData);
      items = migratedData.items;
      metadata = migratedData._metadata;
    }
    sha = data.sha;
  } catch (err) {
    if (err.status !== 404) {
      core.error(err);
    }
    return { items: [], sha: '', error: err };
  }
  return { items, sha, metadata };
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

async function saveItems(items, sha, previousMetadata?: DataWithMetadata['_metadata']) {
  try {
    const now = new Date();
    const runId = now.toISOString().replace(/[:.]/g, '').slice(0, 15); // 20250729T153000
    
    const newData: DataWithMetadata = {
      _metadata: {
        version: "2.0",
        lastUpdate: now.toISOString(),
        runId: runId,
        previousUpdate: previousMetadata?.lastUpdate || null
      },
      items: items
    };

    const commitOptions: any = {
      owner: storageOwner,
      repo: storageRepo,
      path: storagePath,
      message: `Project update ${runId}`,
      content: Buffer.from(JSON.stringify(newData, null, 2)).toString('base64'),
      sha,
      committer: {
        name: committerName,
        email: committerEmail
      }
    };
    
    // Only add the branch property if a branch name is specified
    if (branchName && branchName.trim() !== '') {
      debug(`Using branch: "${branchName}" for commit`);
      commitOptions.branch = branchName;
    } else {
      debug('No branch specified, using default branch');
    }

    debug('Saving with metadata:', newData._metadata);
    
    await storageOctokit.rest.repos.createOrUpdateFileContents(commitOptions);
  } catch (err) {
    core.error(err);
    core.setFailed(`Error saving items: ${err}`);
  }
}

export default { getOldItems, getNewItems, saveItems };