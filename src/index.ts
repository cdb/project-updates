import { setFailed, setOutput } from '@actions/core';
import api, { NewItemsRecord } from './api.js';
import outputs from './outputs.js';
import { debug } from './helpers.js';
import comparator from './comparator.js';
import summary from './summary.js';

export async function run(): Promise<void> {
  try {
    let isFirstRun = false;
    let { items: oldItems, sha, error, metadata } = await api.getOldItems();
    if (error) {
      debug('error', error);
      if (error.status === 404) {
        debug('first run');
        isFirstRun = true;
      } else {
        // If there's an error loading old items (other than 404), we should fail
        throw new Error(`Failed to load old items: ${error.message}`);
      }
    } else {
      debug('oldItems', oldItems);
    }

    let newItems: NewItemsRecord;
    try {
      newItems = await api.getNewItems();
      debug('newItems:', newItems);
    } catch (error) {
      // If we fail to fetch new items, we should not save anything
      // to avoid treating the failure as "everything was removed"
      throw new Error(`Failed to fetch new items from project: ${error.message}`);
    }

    await api.saveItems(newItems, sha, metadata);
    let diff = comparator.diff(oldItems, newItems);

    // Send a simple summary and return
    if (isFirstRun) {
      await summary.outputFirstRun(newItems);
      return;
    }

    // It's not the first run, lets diff it, and send real summaries
    outputs.diff(diff);
    const msg = await summary.outputDiff(diff, metadata);
    setOutput('updates', msg);
  } catch (error) {
    setFailed(error.message);
  }
}

run();
