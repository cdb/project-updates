import { setFailed, setOutput } from '@actions/core';
import api, { NewItemsMap } from './api.js';
import outputs from './outputs.js';
import { debug } from './helpers.js';
import comparator from './comparator.js';
import summary from './summary.js';

async function run(): Promise<void> {
  try {
    let isFirstRun = false;
    let { items: oldItems, sha, error } = await api.getOldItems();
    if (error) {
      debug('error', error);
      if (error.status === 404) {
        debug('first run');
        isFirstRun = true;
      }
    } else {
      debug('oldItems', oldItems);
    }

    let newItems = await api.getNewItems();
    debug('newItems:', newItems);

    await api.saveItems(newItems, sha);
    let diff = comparator.diff(oldItems, newItems);

    // Send a simple summary and return
    if (isFirstRun) {
      await summary.outputFirstRun(newItems);
      return;
    }

    // It's not the first run, lets diff it, and send real summaries
    outputs.diff(diff);
    const msg = await summary.outputDiff(diff);
    setOutput('updates', msg);
  } catch (error) {
    setFailed(error.message);
  }
}

run();
