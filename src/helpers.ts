import * as core from '@actions/core';

export function debug(name, obj = {}) {
  core.debug(`${name}: ${JSON.stringify(obj)}`);
}
