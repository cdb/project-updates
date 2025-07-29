// Test fixtures and sample data
export const sampleOldItems = {
  "ITEM_1": {
    type: "ISSUE",
    title: "Fix bug in login",
    status: "Todo", 
    labels: ["bug"],
    url: "https://github.com/test/repo/issues/1",
    closed: false,
    assignees: []
  },
  "ITEM_2": {
    type: "ISSUE", 
    title: "Add new feature",
    status: "In Progress",
    labels: ["enhancement"],
    url: "https://github.com/test/repo/issues/2", 
    closed: false,
    assignees: ["alice"]
  }
};

export const sampleNewItems = {
  "ITEM_1": {
    type: "ISSUE",
    title: "Fix critical bug in login", // Title changed
    status: "In Progress", // Status changed
    labels: ["bug", "high-priority"], // Label added
    url: "https://github.com/test/repo/issues/1",
    closed: false,
    assignees: ["bob"] // Assignee changed
  },
  "ITEM_2": {
    type: "ISSUE",
    title: "Add new feature", 
    status: "Done", // Status changed
    labels: ["enhancement"],
    url: "https://github.com/test/repo/issues/2",
    closed: true, // Closed
    assignees: ["alice"]
  },
  "ITEM_3": {
    type: "ISSUE",
    title: "New issue",
    status: "Todo",
    labels: [],
    url: "https://github.com/test/repo/issues/3",
    closed: false,
    assignees: []
  }
};

export const oldFormatData = {
  "ITEM_1": {
    type: "ISSUE", 
    title: "Test item",
    status: "Todo"
  }
};

export const newFormatData = {
  _metadata: {
    version: "2.0",
    lastUpdate: "2025-07-29T10:00:00.000Z",
    runId: "20250729T100000", 
    previousUpdate: "2025-07-29T09:00:00.000Z"
  },
  items: {
    "ITEM_1": {
      type: "ISSUE",
      title: "Test item", 
      status: "Todo"
    }
  }
};

export const mockGitHubApiResponse = {
  data: {
    content: Buffer.from(JSON.stringify(oldFormatData)).toString('base64'),
    sha: 'abc123'
  }
};