import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import * as core from '@actions/core';
import { Octokit } from '@octokit/rest';
import {
  sampleOldItems,
  sampleNewItems,
  oldFormatData,
  newFormatData
} from './test-data.js';

// Mock all external dependencies
const mockOctokit = {
  rest: {
    repos: {
      getContent: jest.fn(),
      createOrUpdateFileContents: jest.fn()
    }
  }
};

const mockSummary = {
  addRaw: jest.fn(),
  stringify: jest.fn(() => 'integration test summary'),
  write: jest.fn()
};

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn(() => mockOctokit)
}));

jest.mock('@actions/core', () => ({
  getInput: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  summary: mockSummary
}));

jest.mock('github-project', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    items: {
      list: jest.fn().mockResolvedValue([
        {
          type: 'ISSUE',
          content: {
            id: 'ITEM_1',
            url: 'https://github.com/test/repo/issues/1',
            labels: ['bug', 'high-priority'],
            closed: false,
            merged: false,
            assignees: ['bob']
          },
          fields: {
            title: 'Fix critical bug in login',
            status: 'In Progress'
          }
        },
        {
          type: 'ISSUE',
          content: {
            id: 'ITEM_2',
            url: 'https://github.com/test/repo/issues/2',
            labels: ['enhancement'],
            closed: true,
            merged: false,
            assignees: ['alice']
          },
          fields: {
            title: 'Add new feature',
            status: 'Done'
          }
        },
        {
          type: 'ISSUE',
          content: {
            id: 'ITEM_3',
            url: 'https://github.com/test/repo/issues/3',
            labels: [],
            closed: false,
            merged: false,
            assignees: []
          },
          fields: {
            title: 'New issue',
            status: 'Todo'
          }
        }
      ])
    }
  }))
}));

jest.mock('node-fetch', () => ({
  __esModule: true,
  default: jest.fn()
}));

describe('Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      const inputs = {
        storage_token: 'test-storage-token',
        storage_repository: 'test/repo',
        storage_path: 'data/updates.json',
        committer_name: 'Test Bot',
        committer_email: 'bot@test.com',
        project_organization: 'test-org',
        project_number: '123',
        project_token: 'test-project-token',
        custom_fields: '',
        filter: '',
        branch: ''
      };
      return inputs[name] || '';
    });

    mockOctokit.rest.repos.createOrUpdateFileContents.mockResolvedValue({});
  });

  describe('Complete workflow', () => {
    it('should handle first run scenario', async () => {
      // Mock 404 for first run (no existing data)
      const error404 = new Error('Not Found');
      (error404 as any).status = 404;
      mockOctokit.rest.repos.getContent.mockRejectedValue(error404);

      // Import and run the main function
      const { run } = await import('../src/index.js');
      await run();

      // Verify first run behavior
      expect(mockSummary.addRaw).toHaveBeenCalledWith(
        '\n## :information_source: First Run Detected'
      );
      expect(mockSummary.addRaw).toHaveBeenCalledWith(
        '\n\nImporting 3 issues from the project but will not generate output for this run.'
      );

      // Verify save was called with new format
      expect(
        mockOctokit.rest.repos.createOrUpdateFileContents
      ).toHaveBeenCalled();
      const saveCall = (
        mockOctokit.rest.repos.createOrUpdateFileContents as jest.Mock
      ).mock.calls[0][0];
      const savedContent = JSON.parse(
        Buffer.from(saveCall.content, 'base64').toString()
      );

      expect(savedContent._metadata).toBeDefined();
      expect(savedContent._metadata.version).toBe('2.0');
      expect(savedContent.items).toBeDefined();
    });

    it('should handle normal run with changes', async () => {
      // Mock existing old format data
      mockOctokit.rest.repos.getContent.mockResolvedValue({
        data: {
          content: Buffer.from(JSON.stringify(sampleOldItems)).toString(
            'base64'
          ),
          sha: 'test-sha'
        }
      });

      const { run } = await import('../src/index.js');
      await run();

      // Verify outputs were set
      expect(core.setOutput).toHaveBeenCalledWith('added', expect.any(String));
      expect(core.setOutput).toHaveBeenCalledWith(
        'removed',
        expect.any(String)
      );
      expect(core.setOutput).toHaveBeenCalledWith(
        'changed',
        expect.any(String)
      );
      expect(core.setOutput).toHaveBeenCalledWith(
        'updates',
        'integration test summary'
      );

      // Verify summary was generated with sections
      const summaryAddRawCalls = (mockSummary.addRaw as jest.Mock).mock.calls;
      const summaryContent = summaryAddRawCalls.map((call) => call[0]).join('');

      expect(summaryContent).toContain('🚀 **Work Started**');
      expect(summaryContent).toContain('✅ **Completed**');
      expect(summaryContent).toContain('➕ **Added to Board**');
    });

    it('should handle backward compatibility migration', async () => {
      // Mock old format data
      mockOctokit.rest.repos.getContent.mockResolvedValue({
        data: {
          content: Buffer.from(JSON.stringify(oldFormatData)).toString(
            'base64'
          ),
          sha: 'old-sha'
        }
      });

      const { run } = await import('../src/index.js');
      await run();

      // Verify data was migrated and saved in new format
      const saveCall = (
        mockOctokit.rest.repos.createOrUpdateFileContents as jest.Mock
      ).mock.calls[0][0];
      const savedContent = JSON.parse(
        Buffer.from(saveCall.content, 'base64').toString()
      );

      expect(savedContent._metadata).toBeDefined();
      expect(savedContent._metadata.version).toBe('2.0');
      expect(savedContent._metadata.lastUpdate).toBeDefined();
      expect(savedContent._metadata.runId).toBeDefined();
      expect(savedContent._metadata.previousUpdate).toBeNull(); // First time saving metadata
      expect(savedContent.items).toBeDefined();
    });

    it('should handle new format data with time context', async () => {
      // Mock new format data with previous timestamp
      const dataWithTime = {
        ...newFormatData,
        _metadata: {
          ...newFormatData._metadata,
          lastUpdate: '2025-07-29T09:00:00.000Z',
          previousUpdate: '2025-07-29T08:30:00.000Z'
        }
      };

      mockOctokit.rest.repos.getContent.mockResolvedValue({
        data: {
          content: Buffer.from(JSON.stringify(dataWithTime)).toString('base64'),
          sha: 'new-sha'
        }
      });

      const { run } = await import('../src/index.js');
      await run();

      // Verify time context was used in summary
      const summaryContent = (mockSummary.addRaw as jest.Mock).mock.calls
        .map((call) => call[0])
        .join('');
      expect(summaryContent).toContain('since last update');
      expect(summaryContent).toContain('ago');
    });

    it('should fail workflow when old items cannot be loaded', async () => {
      // Mock API error
      const apiError = new Error('API Error');
      (apiError as any).status = 500;
      mockOctokit.rest.repos.getContent.mockRejectedValue(apiError);

      const { run } = await import('../src/index.js');
      await run();

      // Verify error handling - should fail the workflow
      expect(core.error).toHaveBeenCalledWith(apiError);
      expect(core.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load old items')
      );
    });

    it('should fail workflow when fetching new items fails without saving', async () => {
      // Mock successful load of old items
      mockOctokit.rest.repos.getContent.mockResolvedValue({
        data: {
          content: Buffer.from(JSON.stringify(newFormatData)).toString(
            'base64'
          ),
          sha: 'abc123'
        }
      });

      // Mock failure when fetching new items from project
      const mockGitHubProject = await import('github-project');
      const fetchError = new Error(
        "We couldn't respond to your request in time"
      );
      (fetchError as any).status = 504;

      const mockProject = {
        items: {
          list: jest.fn().mockRejectedValue(fetchError)
        }
      };
      (mockGitHubProject.default as jest.Mock).mockReturnValue(mockProject);

      const { run } = await import('../src/index.js');
      await run();

      // Verify workflow failed
      expect(core.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch new items from project')
      );

      // Verify saveItems was NOT called (should not save empty data)
      expect(
        mockOctokit.rest.repos.createOrUpdateFileContents
      ).not.toHaveBeenCalled();
    });

    it('should handle no changes scenario', async () => {
      // Mock existing data that matches current project state
      const currentProjectData = {
        ITEM_1: {
          type: 'ISSUE',
          title: 'Fix critical bug in login',
          status: 'In Progress',
          labels: ['bug', 'high-priority'],
          url: 'https://github.com/test/repo/issues/1',
          closed: false,
          assignees: ['bob']
        },
        ITEM_2: {
          type: 'ISSUE',
          title: 'Add new feature',
          status: 'Done',
          labels: ['enhancement'],
          url: 'https://github.com/test/repo/issues/2',
          closed: true,
          assignees: ['alice']
        },
        ITEM_3: {
          type: 'ISSUE',
          title: 'New issue',
          status: 'Todo',
          labels: [],
          url: 'https://github.com/test/repo/issues/3',
          closed: false,
          assignees: []
        }
      };

      mockOctokit.rest.repos.getContent.mockResolvedValue({
        data: {
          content: Buffer.from(JSON.stringify(currentProjectData)).toString(
            'base64'
          ),
          sha: 'no-changes-sha'
        }
      });

      const { run } = await import('../src/index.js');
      await run();

      // Verify no output for no changes
      expect(mockSummary.addRaw).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty project', async () => {
      // Mock empty old data
      mockOctokit.rest.repos.getContent.mockResolvedValue({
        data: {
          content: Buffer.from(JSON.stringify({})).toString('base64'),
          sha: 'empty-sha'
        }
      });

      // Mock empty new data
      const GitHubProject = await import('github-project');
      const mockProject = {
        items: {
          list: jest.fn().mockResolvedValue([])
        }
      };
      (GitHubProject.default as jest.Mock).mockReturnValue(mockProject);

      const { run } = await import('../src/index.js');
      await run();

      expect(mockSummary.addRaw).not.toHaveBeenCalled();
    });

    it('should handle large number of changes', async () => {
      // Mock old data with many items
      const manyOldItems = {};
      for (let i = 1; i <= 50; i++) {
        manyOldItems[`ITEM_${i}`] = {
          type: 'ISSUE',
          title: `Issue ${i}`,
          status: 'Todo',
          labels: [],
          url: `https://github.com/test/repo/issues/${i}`,
          closed: false,
          assignees: []
        };
      }

      mockOctokit.rest.repos.getContent.mockResolvedValue({
        data: {
          content: Buffer.from(JSON.stringify(manyOldItems)).toString('base64'),
          sha: 'many-items-sha'
        }
      });

      // Mock new data with status changes
      const manyNewItems = [];
      for (let i = 1; i <= 50; i++) {
        manyNewItems.push({
          type: 'ISSUE',
          content: {
            id: `ITEM_${i}`,
            url: `https://github.com/test/repo/issues/${i}`,
            labels: [],
            closed: false,
            merged: false,
            assignees: []
          },
          fields: {
            title: `Issue ${i}`,
            status: 'In Progress' // All changed status
          }
        });
      }

      const GitHubProject = await import('github-project');
      const mockProject = {
        items: {
          list: jest.fn().mockResolvedValue(manyNewItems)
        }
      };
      (GitHubProject.default as jest.Mock).mockReturnValue(mockProject);

      const { run } = await import('../src/index.js');
      await run();

      // Should show cadence insight for large number of changes
      const summaryContent = (mockSummary.addRaw as jest.Mock).mock.calls
        .map((call) => call[0])
        .join('');
      expect(summaryContent).toContain('50 items moved forward');
    });
  });
});
