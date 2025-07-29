// Test setup file
import { jest } from '@jest/globals';

// Mock @actions/core module
const mockSummary = {
  addRaw: jest.fn(),
  stringify: jest.fn(() => 'mock summary'),
  write: jest.fn()
};

jest.mock('@actions/core', () => ({
  getInput: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  summary: mockSummary
}));

// Mock @octokit/rest
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn(() => ({
    rest: {
      repos: {
        getContent: jest.fn(),
        createOrUpdateFileContents: jest.fn()
      }
    }
  }))
}));

// Mock github-project
jest.mock('github-project', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    items: {
      list: jest.fn()
    }
  }))
}));

// Mock node-fetch
jest.mock('node-fetch', () => ({
  __esModule: true,
  default: jest.fn()
}));
