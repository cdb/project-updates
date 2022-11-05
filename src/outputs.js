import * as core from '@actions/core';

function diff({ added, removed, changed }) {
  core.setOutput('added', JSON.stringify(added));
  core.setOutput('removed', JSON.stringify(removed));
  core.setOutput('changed', JSON.stringify(changed));
}

export default { diff };
