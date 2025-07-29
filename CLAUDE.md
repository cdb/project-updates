# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a GitHub Action that tracks changes on GitHub Projects V2 boards. It fetches project data, stores it as JSON in a repository, and outputs structured summaries of changes (additions, removals, modifications, completions) that can be used for notifications or reporting.

## Commands

### Development Commands
- `npm run dev` - Run the TypeScript source directly with ts-node
- `npm run build` - Build the action using ncc (outputs to ./dist)
- `npm test` - Currently not implemented (exits with error)

### Code Quality
- Code formatting: Uses Prettier (available in devDependencies)
- No linting configuration detected

## Architecture

### Core Flow
The main entry point (`src/index.ts`) orchestrates these key operations:
1. **Fetch old data** - Retrieves previously stored project state from repository storage
2. **Fetch new data** - Gets current project state from GitHub API  
3. **Save new data** - Commits updated state to storage repository
4. **Generate diff** - Compares old vs new state to identify changes
5. **Output results** - Produces structured summaries and sets GitHub Action outputs

### Key Modules
- `api.ts` - GitHub API interactions for project data and repository storage
- `comparator.ts` - Diff logic to identify changes between project states
- `outputs.ts` - GitHub Action output formatting
- `summary.ts` - Summary generation for first runs and diffs
- `helpers.ts` - Utility functions including debug logging

### Configuration
The action is configured via `action.yml` inputs:
- Project access (token, organization, project number)
- Storage location (repository, path, branch, committer info)
- Filtering (custom fields, project filters)

### Build System
- TypeScript with ES modules (`"type": "module"`)
- Uses `@vercel/ncc` to bundle everything into `dist/index.js` for distribution
- Target: Node 20 runtime environment

### Dependencies
- GitHub Actions SDK (`@actions/core`, `@actions/github`)
- GitHub API client (`@octokit/rest`, `github-project`)
- Utilities (`lodash`, `node-fetch`)