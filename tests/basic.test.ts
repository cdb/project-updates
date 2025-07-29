import { describe, it, expect } from '@jest/globals';

describe('Basic test', () => {
  it('should pass', () => {
    expect(true).toBe(true);
  });

  it('should handle simple math', () => {
    expect(2 + 2).toBe(4);
  });
});
