import { debug } from '@actions/core';

export function debug(name, obj) {
  debug(`${name}: ${JSON.stringify(obj)}`);
}
