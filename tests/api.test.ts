import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Octokit } from '@octokit/rest';
import * as core from '@actions/core';
import { oldFormatData, newFormatData, mockGitHubApiResponse } from './test-data.js';

// Mock modules
const mockOctokit = {
  rest: {
    repos: {
      getContent: jest.fn(),
      createOrUpdateFileContents: jest.fn()
    }
  }
};

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn(() => mockOctokit)
}));

jest.mock('@actions/core', () => ({
  getInput: jest.fn(),
  setFailed: jest.fn(),
  error: jest.fn()
}));

jest.mock('github-project', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    items: {
      list: jest.fn()
    }
  }))
}));

// Import after mocking
const api = await import('../src/api.js');

describe('api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock implementations
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      const inputs = {
        'storage_token': 'test-token',
        'storage_repository': 'owner/repo',
        'storage_path': 'data.json',
        'committer_name': 'Test User',
        'committer_email': 'test@example.com',
        'project_organization': 'test-org',
        'project_number': '123',
        'project_token': 'project-token',
        'custom_fields': '',
        'filter': '',
        'branch': ''
      };
      return inputs[name] || '';
    });
  });

  describe('getOldItems', () => {
    it('should handle old format data and migrate it', async () => {
      mockOctokit.rest.repos.getContent.mockResolvedValue({
        data: {
          content: Buffer.from(JSON.stringify(oldFormatData)).toString('base64'),
          sha: 'abc123'
        }
      });

      const result = await api.default.getOldItems();

      expect(result.items).toEqual(oldFormatData);
      expect(result.sha).toBe('abc123');
      expect(result.metadata).toEqual({
        version: '2.0',
        lastUpdate: null,
        runId: null,
        previousUpdate: null
      });
    });

    it('should handle new format data correctly', async () => {
      mockOctokit.rest.repos.getContent.mockResolvedValue({
        data: {
          content: Buffer.from(JSON.stringify(newFormatData)).toString('base64'),
          sha: 'def456'
        }
      });

      const result = await api.default.getOldItems();

      expect(result.items).toEqual(newFormatData.items);
      expect(result.sha).toBe('def456');
      expect(result.metadata).toEqual(newFormatData._metadata);
    });

    it('should handle 404 errors (first run)', async () => {
      const error404 = new Error('Not Found');
      (error404 as any).status = 404;
      mockOctokit.rest.repos.getContent.mockRejectedValue(error404);

      const result = await api.default.getOldItems();

      expect(result.items).toEqual([]);
      expect(result.sha).toBe('');
      expect(result.error).toBe(error404);
    });

    it('should handle other errors', async () => {
      const error500 = new Error('Server Error');
      (error500 as any).status = 500;
      mockOctokit.rest.repos.getContent.mockRejectedValue(error500);

      const result = await api.default.getOldItems();

      expect(result.error).toBe(error500);
      expect(core.error).toHaveBeenCalledWith(error500);
    });
  });

  describe('saveItems', () => {
    it('should save items with new metadata format', async () => {
      const items = { 'ITEM_1': { title: 'Test' } };
      const sha = 'abc123';
      const previousMetadata = {
        version: '2.0',
        lastUpdate: '2025-07-29T09:00:00.000Z',
        runId: '20250729T090000',
        previousUpdate: null
      };

      mockOctokit.rest.repos.createOrUpdateFileContents.mockResolvedValue({});

      await api.default.saveItems(items, sha, previousMetadata);

      expect(mockOctokit.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'owner',
          repo: 'repo',
          path: 'data.json',
          sha: 'abc123',
          committer: {
            name: 'Test User',
            email: 'test@example.com'
          }
        })
      );

      // Verify the content structure
      const call = (mockOctokit.rest.repos.createOrUpdateFileContents as jest.Mock).mock.calls[0][0];
      const content = JSON.parse(Buffer.from(call.content, 'base64').toString());
      
      expect(content._metadata).toBeDefined();
      expect(content._metadata.version).toBe('2.0');
      expect(content._metadata.lastUpdate).toBeDefined();
      expect(content._metadata.runId).toBeDefined();
      expect(content._metadata.previousUpdate).toBe('2025-07-29T09:00:00.000Z');
      expect(content.items).toEqual(items);
    });

    it('should handle first save (no previous metadata)', async () => {
      const items = { 'ITEM_1': { title: 'Test' } };
      const sha = 'abc123';

      await api.default.saveItems(items, sha);

      const call = (mockOctokit.rest.repos.createOrUpdateFileContents as jest.Mock).mock.calls[0][0];
      const content = JSON.parse(Buffer.from(call.content, 'base64').toString());
      
      expect(content._metadata.previousUpdate).toBeNull();
    });

    it('should use branch when specified', async () => {
      (core.getInput as jest.Mock).mockImplementation((name: string) => {
        if (name === 'branch') return 'test-branch';
        return name === 'storage_repository' ? 'owner/repo' : 'default';
      });

      await api.default.saveItems({}, 'sha');

      expect(mockOctokit.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
        expect.objectContaining({
          branch: 'test-branch'
        })
      );
    });

    it('should handle save errors', async () => {
      const error = new Error('Save failed');
      mockOctokit.rest.repos.createOrUpdateFileContents.mockRejectedValue(error);

      await api.default.saveItems({}, 'sha');

      expect(core.error).toHaveBeenCalledWith(error);
      expect(core.setFailed).toHaveBeenCalledWith('Error saving items: Error: Save failed');
    });
  });

  describe('getNewItems', () => {
    const mockGitHubProject = await import('github-project');
    
    it('should fetch and format project items', async () => {
      const mockItems = [
        {
          type: 'ISSUE',
          content: {
            id: 'ITEM_1',
            url: 'https://github.com/test/repo/issues/1',
            labels: ['bug'],
            closed: false,
            merged: false,
            assignees: ['alice']
          },
          fields: {
            title: 'Test Issue',
            status: 'Todo'
          }
        }
      ];

      const mockProject = {
        items: {
          list: jest.fn().mockResolvedValue(mockItems)
        }
      };

      (mockGitHubProject.default as jest.Mock).mockReturnValue(mockProject);

      const result = await api.default.getNewItems();

      expect(result).toEqual({
        'ITEM_1': {
          type: 'ISSUE',
          title: 'Test Issue',
          status: 'Todo',
          labels: ['bug'],
          url: 'https://github.com/test/repo/issues/1',
          closed: false,
          merged: false,
          assignees: ['alice']
        }
      });
    });

    it('should handle items without content.id (skip them)', async () => {
      const mockItems = [
        {
          type: 'DRAFT_ISSUE',
          content: {}, // No id
          fields: {
            title: 'Draft Issue',
            status: 'Todo'
          }
        }
      ];

      const mockProject = {
        items: {
          list: jest.fn().mockResolvedValue(mockItems)
        }
      };

      (mockGitHubProject.default as jest.Mock).mockReturnValue(mockProject);

      const result = await api.default.getNewItems();

      expect(result).toEqual({});
    });

    it('should handle errors gracefully', async () => {
      const mockProject = {
        items: {
          list: jest.fn().mockRejectedValue(new Error('API Error'))
        }
      };

      (mockGitHubProject.default as jest.Mock).mockReturnValue(mockProject);

      const result = await api.default.getNewItems();

      expect(result).toEqual({});
      expect(core.error).toHaveBeenCalled();
    });
  });
});