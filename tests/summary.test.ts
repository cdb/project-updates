import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import * as core from '@actions/core';

// We need to mock the module before importing
const mockSummary = {
  addRaw: jest.fn(),
  stringify: jest.fn(() => 'test summary'),
  write: jest.fn()
};

jest.mock('@actions/core', () => ({
  summary: mockSummary,
  setOutput: jest.fn(),
  error: jest.fn()
}));

// Import after mocking
const summary = await import('../src/summary.js');

describe('summary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('outputFirstRun', () => {
    it('should generate first run message', async () => {
      const items = {
        'item1': { 
          type: 'ISSUE',
          title: 'Test 1',
          status: 'Todo',
          labels: '',
          url: 'https://github.com/test/repo/issues/1',
          closed: '',
          merged: '',
          assignees: ''
        },
        'item2': { 
          type: 'ISSUE',
          title: 'Test 2',
          status: 'Todo',
          labels: '',
          url: 'https://github.com/test/repo/issues/2',
          closed: '',
          merged: '',
          assignees: ''
        }
      };

      await summary.default.outputFirstRun(items);

      expect(mockSummary.addRaw).toHaveBeenCalledWith(
        '\n## :information_source: First Run Detected'
      );
      expect(mockSummary.addRaw).toHaveBeenCalledWith(
        '\n\nImporting 2 issues from the project but will not generate output for this run.'
      );
    });

    it('should handle empty items correctly', async () => {
      const items = {};

      await summary.default.outputFirstRun(items);

      expect(mockSummary.addRaw).toHaveBeenCalledWith(
        '\n## :information_source: First Run Detected'
      );
      expect(mockSummary.addRaw).toHaveBeenCalledWith(
        '\n\nImporting 0 issues from the project but will not generate output for this run.'
      );
    });
  });

  describe('outputDiff', () => {
    it('should produce no output when no changes', async () => {
      const diff = { added: [], removed: [], changed: [], closed: [] };

      const result = await summary.default.outputDiff(diff);

      expect(mockSummary.addRaw).not.toHaveBeenCalled();
      expect(result).toBe('test summary');
    });

    it('should group work started items correctly', async () => {
      const diff = {
        added: [],
        removed: [],
        closed: [],
        changed: [
          {
            title: 'Test Item',
            url: 'https://github.com/test/repo/issues/1',
            status: { prev: 'Todo', next: 'In Progress' },
            assignees_added: ['alice']
          }
        ]
      };

      await summary.default.outputDiff(diff);

      expect(mockSummary.addRaw).toHaveBeenCalledWith('🚀 **Work Started**\n');
      expect(mockSummary.addRaw).toHaveBeenCalledWith(
        '- [Test Item](https://github.com/test/repo/issues/1) - 🚀 Work started • 👨‍💻 alice picked this up\n'
      );
    });

    it('should group completed items correctly', async () => {
      const diff = {
        added: [],
        removed: [],
        changed: [],
        closed: [
          {
            title: 'Completed Item',
            url: 'https://github.com/test/repo/issues/2'
          }
        ]
      };

      await summary.default.outputDiff(diff);

      expect(mockSummary.addRaw).toHaveBeenCalledWith('✅ **Completed**\n');
      expect(mockSummary.addRaw).toHaveBeenCalledWith(
        '- [Completed Item](https://github.com/test/repo/issues/2)\n'
      );
    });

    it('should show cadence insights with time context', async () => {
      const diff = {
        added: [{ title: 'Item 1' }],
        removed: [],
        changed: [
          { title: 'Item 2', status: { next: 'In Progress' } },
          { title: 'Item 3', status: { next: 'Done' } }
        ],
        closed: []
      };

      const metadata = {
        lastUpdate: '2025-07-29T10:00:00.000Z',
        previousUpdate: '2025-07-29T09:30:00.000Z'
      };

      await summary.default.outputDiff(diff, metadata);

      expect(mockSummary.addRaw).toHaveBeenCalledWith(
        '📈 **3 items moved forward since last update (30 minutes ago)**\n\n'
      );
    });

    it('should handle added items', async () => {
      const diff = {
        added: [
          {
            title: 'New Item',
            url: 'https://github.com/test/repo/issues/3'
          }
        ],
        removed: [],
        changed: [],
        closed: []
      };

      await summary.default.outputDiff(diff);

      expect(mockSummary.addRaw).toHaveBeenCalledWith(
        '➕ **Added to Board**\n'
      );
      expect(mockSummary.addRaw).toHaveBeenCalledWith(
        '- [New Item](https://github.com/test/repo/issues/3)\n'
      );
    });

    it('should handle removed items', async () => {
      const diff = {
        added: [],
        removed: [
          {
            title: 'Removed Item',
            url: 'https://github.com/test/repo/issues/4'
          }
        ],
        changed: [],
        closed: []
      };

      await summary.default.outputDiff(diff);

      expect(mockSummary.addRaw).toHaveBeenCalledWith(
        '❌ **Removed from Board**\n'
      );
      expect(mockSummary.addRaw).toHaveBeenCalledWith(
        '- [Removed Item](https://github.com/test/repo/issues/4)\n'
      );
    });

    it('should handle other updates (non-status changes)', async () => {
      const diff = {
        added: [],
        removed: [],
        closed: [],
        changed: [
          {
            title: 'Updated Item',
            url: 'https://github.com/test/repo/issues/5',
            labels_added: ['urgent'],
            assignees_added: ['bob']
          }
        ]
      };

      await summary.default.outputDiff(diff);

      expect(mockSummary.addRaw).toHaveBeenCalledWith('🔄 **Other Updates**\n');
      expect(mockSummary.addRaw).toHaveBeenCalledWith(
        '- [Updated Item](https://github.com/test/repo/issues/5) - 🏷️ Tagged: urgent • 👨‍💻 bob picked this up\n'
      );
    });
  });

  describe('time formatting', () => {
    // We can't directly test the internal formatTimeAgo function,
    // but we can test it through the outputDiff function
    it('should format minutes correctly', async () => {
      const diff = { added: [{}], removed: [], changed: [], closed: [] };
      const metadata = {
        lastUpdate: '2025-07-29T10:00:00.000Z',
        previousUpdate: '2025-07-29T09:45:00.000Z' // 15 minutes ago
      };

      await summary.default.outputDiff(diff, metadata);

      const calls = (mockSummary.addRaw as jest.Mock).mock.calls;
      const cadenceCall = calls.find((call) =>
        call[0].includes('since last update')
      );
      expect(cadenceCall[0]).toContain('15 minutes ago');
    });

    it('should format hours correctly', async () => {
      const diff = {
        added: [{}, {}, {}],
        removed: [],
        changed: [],
        closed: []
      };
      const metadata = {
        lastUpdate: '2025-07-29T10:00:00.000Z',
        previousUpdate: '2025-07-29T07:30:00.000Z' // 2.5 hours ago
      };

      await summary.default.outputDiff(diff, metadata);

      const calls = (mockSummary.addRaw as jest.Mock).mock.calls;
      const cadenceCall = calls.find((call) =>
        call[0].includes('since last update')
      );
      expect(cadenceCall[0]).toContain('2.5 hours ago');
    });
  });
});
