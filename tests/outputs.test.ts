import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import * as core from '@actions/core';

jest.mock('@actions/core', () => ({
  setOutput: jest.fn()
}));

const outputs = await import('../src/outputs.js');

describe('outputs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('diff', () => {
    it('should set GitHub Action outputs correctly', () => {
      const diff = {
        added: [
          { title: 'New Item 1', url: 'https://github.com/test/repo/issues/1' },
          { title: 'New Item 2', url: 'https://github.com/test/repo/issues/2' }
        ],
        removed: [
          {
            title: 'Removed Item',
            url: 'https://github.com/test/repo/issues/3'
          }
        ],
        changed: [
          {
            title: 'Changed Item',
            url: 'https://github.com/test/repo/issues/4',
            status: { prev: 'Todo', next: 'In Progress' }
          }
        ]
      };

      outputs.default.diff(diff);

      expect(core.setOutput).toHaveBeenCalledWith(
        'added',
        JSON.stringify(diff.added)
      );
      expect(core.setOutput).toHaveBeenCalledWith(
        'removed',
        JSON.stringify(diff.removed)
      );
      expect(core.setOutput).toHaveBeenCalledWith(
        'changed',
        JSON.stringify(diff.changed)
      );
      expect(core.setOutput).toHaveBeenCalledTimes(3);
    });

    it('should handle empty diff', () => {
      const diff = {
        added: [],
        removed: [],
        changed: []
      };

      outputs.default.diff(diff);

      expect(core.setOutput).toHaveBeenCalledWith('added', '[]');
      expect(core.setOutput).toHaveBeenCalledWith('removed', '[]');
      expect(core.setOutput).toHaveBeenCalledWith('changed', '[]');
    });

    it('should serialize complex objects correctly', () => {
      const diff = {
        added: [],
        removed: [],
        changed: [
          {
            title: 'Complex Item',
            url: 'https://github.com/test/repo/issues/5',
            status: { prev: 'Todo', next: 'Done' },
            labels_added: ['urgent', 'bug'],
            assignees_added: ['alice', 'bob'],
            previous_title: 'Old Title'
          }
        ]
      };

      outputs.default.diff(diff);

      const changedCall = (core.setOutput as jest.Mock).mock.calls.find(
        (call) => call[0] === 'changed'
      );

      const parsedChanged = JSON.parse(changedCall[1]);
      expect(parsedChanged[0]).toEqual(diff.changed[0]);
    });
  });
});
