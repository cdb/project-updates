import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock @actions/core for debug function
jest.mock('@actions/core', () => ({
  debug: jest.fn()
}));

const helpers = await import('../src/helpers.js');

describe('helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('debug', () => {
    it('should call core.debug with formatted message', () => {
      const core = await import('@actions/core');
      
      helpers.debug('test message', { key: 'value' });
      
      expect(core.debug).toHaveBeenCalledWith('test message {"key":"value"}');
    });

    it('should handle debug without data', () => {
      const core = await import('@actions/core');
      
      helpers.debug('simple message');
      
      expect(core.debug).toHaveBeenCalledWith('simple message');
    });

    it('should handle complex objects', () => {
      const core = await import('@actions/core');
      const complexData = {
        nested: {
          array: [1, 2, 3],
          boolean: true,
          null_value: null
        }
      };
      
      helpers.debug('complex', complexData);
      
      expect(core.debug).toHaveBeenCalledWith(
        'complex {"nested":{"array":[1,2,3],"boolean":true,"null_value":null}}'
      );
    });

    it('should handle circular references gracefully', () => {
      const core = await import('@actions/core');
      const circular: any = { name: 'test' };
      circular.self = circular;
      
      // Should not throw an error
      expect(() => helpers.debug('circular', circular)).not.toThrow();
      expect(core.debug).toHaveBeenCalled();
    });

    it('should handle undefined and null data', () => {
      const core = await import('@actions/core');
      
      helpers.debug('undefined test', undefined);
      helpers.debug('null test', null);
      
      expect(core.debug).toHaveBeenCalledWith('undefined test');
      expect(core.debug).toHaveBeenCalledWith('null test null');
    });
  });
});