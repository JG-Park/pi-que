import { LocalStorageService } from '../local-storage.service';
import { createLocalStorageService, getLocalStorageService } from '../local-storage.service';
import { 
  StorageInfo,
  StorageQuota,
  ValidationError, 
  ServiceError 
} from '../../../types/services';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  key: jest.fn(),
  length: 0
};

// Mock navigator.storage
const mockStorageEstimate = jest.fn();
Object.defineProperty(navigator, 'storage', {
  value: {
    estimate: mockStorageEstimate
  },
  configurable: true
});

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

describe('LocalStorageService', () => {
  let storageService: LocalStorageService;

  beforeEach(() => {
    storageService = new LocalStorageService();
    jest.clearAllMocks();
    mockLocalStorage.length = 0;
  });

  describe('Constructor and Factory', () => {
    it('should create instance with default options', () => {
      expect(storageService).toBeInstanceOf(LocalStorageService);
      expect(storageService.isHealthy()).resolves.toBe(true);
    });

    it('should create instance via factory function', () => {
      const service = createLocalStorageService();
      expect(service).toBeInstanceOf(LocalStorageService);
    });

    it('should return singleton instance', () => {
      const service1 = getLocalStorageService();
      const service2 = getLocalStorageService();
      expect(service1).toBe(service2);
    });
  });

  describe('get', () => {
    it('should retrieve existing value', async () => {
      const testData = { name: 'test', value: 123 };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(testData));

      const result = await storageService.get<typeof testData>('test-key');

      expect(result).toEqual(testData);
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('pi-que-test-key');
    });

    it('should return null for non-existent key', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const result = await storageService.get('non-existent');

      expect(result).toBeNull();
    });

    it('should handle corrupted JSON data', async () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');

      await expect(storageService.get('corrupted-key'))
        .rejects.toThrow(ServiceError);
    });

    it('should handle localStorage access errors', async () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Access denied');
      });

      await expect(storageService.get('test-key'))
        .rejects.toThrow(ServiceError);
    });
  });

  describe('set', () => {
    it('should store value successfully', async () => {
      const testData = { name: 'test', value: 123 };

      await storageService.set('test-key', testData);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'pi-que-test-key',
        JSON.stringify(testData)
      );
    });

    it('should handle quota exceeded error', async () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        const error = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });

      await expect(storageService.set('test-key', 'test-value'))
        .rejects.toThrow(ServiceError);
    });

    it('should handle serialization errors', async () => {
      const circularRef: any = {};
      circularRef.self = circularRef;

      await expect(storageService.set('test-key', circularRef))
        .rejects.toThrow(ServiceError);
    });

    it('should validate key parameter', async () => {
      await expect(storageService.set('', 'test-value'))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('remove', () => {
    it('should remove existing key', async () => {
      await storageService.remove('test-key');

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('pi-que-test-key');
    });

    it('should handle localStorage access errors', async () => {
      mockLocalStorage.removeItem.mockImplementation(() => {
        throw new Error('Access denied');
      });

      await expect(storageService.remove('test-key'))
        .rejects.toThrow(ServiceError);
    });

    it('should validate key parameter', async () => {
      await expect(storageService.remove(''))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('clear', () => {
    it('should clear all prefixed keys', async () => {
      mockLocalStorage.key
        .mockReturnValueOnce('pi-que-key1')
        .mockReturnValueOnce('pi-que-key2')
        .mockReturnValueOnce('other-key')
        .mockReturnValueOnce(null);
      mockLocalStorage.length = 3;

      await storageService.clear();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('pi-que-key1');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('pi-que-key2');
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('other-key');
    });

    it('should handle localStorage access errors', async () => {
      mockLocalStorage.key.mockImplementation(() => {
        throw new Error('Access denied');
      });

      await expect(storageService.clear())
        .rejects.toThrow(ServiceError);
    });
  });

  describe('getKeys', () => {
    it('should return all prefixed keys', async () => {
      mockLocalStorage.key
        .mockReturnValueOnce('pi-que-key1')
        .mockReturnValueOnce('pi-que-key2')
        .mockReturnValueOnce('other-key')
        .mockReturnValueOnce(null);
      mockLocalStorage.length = 3;

      const result = await storageService.getKeys();

      expect(result).toEqual(['key1', 'key2']);
    });

    it('should return empty array when no keys exist', async () => {
      mockLocalStorage.length = 0;

      const result = await storageService.getKeys();

      expect(result).toEqual([]);
    });
  });

  describe('exists', () => {
    it('should return true for existing key', async () => {
      mockLocalStorage.getItem.mockReturnValue('some-value');

      const result = await storageService.exists('test-key');

      expect(result).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const result = await storageService.exists('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('getMultiple', () => {
    it('should retrieve multiple values', async () => {
      mockLocalStorage.getItem
        .mockReturnValueOnce(JSON.stringify('value1'))
        .mockReturnValueOnce(JSON.stringify('value2'))
        .mockReturnValueOnce(null);

      const result = await storageService.getMultiple<string>(['key1', 'key2', 'key3']);

      expect(result).toEqual({
        key1: 'value1',
        key2: 'value2',
        key3: null
      });
    });

    it('should handle errors gracefully', async () => {
      mockLocalStorage.getItem
        .mockReturnValueOnce(JSON.stringify('value1'))
        .mockImplementationOnce(() => {
          throw new Error('Access denied');
        });

      await expect(storageService.getMultiple(['key1', 'key2']))
        .rejects.toThrow(ServiceError);
    });
  });

  describe('setMultiple', () => {
    it('should store multiple values', async () => {
      const items = {
        key1: 'value1',
        key2: 'value2'
      };

      await storageService.setMultiple(items);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'pi-que-key1',
        JSON.stringify('value1')
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'pi-que-key2',
        JSON.stringify('value2')
      );
    });

    it('should handle quota exceeded error', async () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        const error = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });

      const items = { key1: 'value1' };

      await expect(storageService.setMultiple(items))
        .rejects.toThrow(ServiceError);
    });
  });

  describe('removeMultiple', () => {
    it('should remove multiple keys', async () => {
      await storageService.removeMultiple(['key1', 'key2']);

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('pi-que-key1');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('pi-que-key2');
    });

    it('should handle localStorage access errors', async () => {
      mockLocalStorage.removeItem.mockImplementation(() => {
        throw new Error('Access denied');
      });

      await expect(storageService.removeMultiple(['key1']))
        .rejects.toThrow(ServiceError);
    });
  });

  describe('getStorageInfo', () => {
    it('should return storage information', async () => {
      mockLocalStorage.key
        .mockReturnValueOnce('pi-que-key1')
        .mockReturnValueOnce('pi-que-key2')
        .mockReturnValueOnce(null);
      mockLocalStorage.length = 2;
      mockLocalStorage.getItem
        .mockReturnValueOnce('{"data":"value1"}') // 18 bytes
        .mockReturnValueOnce('{"data":"value2"}'); // 18 bytes

      const result = await storageService.getStorageInfo();

      expect(result).toMatchObject({
        used: expect.any(Number),
        itemCount: 2
      });
      expect(result.used).toBeGreaterThan(0);
    });

    it('should handle empty storage', async () => {
      mockLocalStorage.length = 0;

      const result = await storageService.getStorageInfo();

      expect(result).toMatchObject({
        used: 0,
        available: expect.any(Number),
        total: expect.any(Number),
        itemCount: 0
      });
    });
  });

  describe('exportData', () => {
    it('should export all prefixed data', async () => {
      mockLocalStorage.key
        .mockReturnValueOnce('pi-que-key1')
        .mockReturnValueOnce('pi-que-key2')
        .mockReturnValueOnce(null);
      mockLocalStorage.length = 2;
      mockLocalStorage.getItem
        .mockReturnValueOnce('{"data":"value1"}')
        .mockReturnValueOnce('{"data":"value2"}');

      const result = await storageService.exportData();

      const exported = JSON.parse(result);
      expect(exported).toMatchObject({
        key1: { data: 'value1' },
        key2: { data: 'value2' }
      });
    });

    it('should handle export errors', async () => {
      mockLocalStorage.key.mockImplementation(() => {
        throw new Error('Access denied');
      });

      await expect(storageService.exportData())
        .rejects.toThrow(ServiceError);
    });
  });

  describe('importData', () => {
    it('should import data successfully', async () => {
      const importData = JSON.stringify({
        key1: { data: 'value1' },
        key2: { data: 'value2' }
      });

      await storageService.importData(importData);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'pi-que-key1',
        JSON.stringify({ data: 'value1' })
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'pi-que-key2',
        JSON.stringify({ data: 'value2' })
      );
    });

    it('should handle invalid JSON', async () => {
      await expect(storageService.importData('invalid json'))
        .rejects.toThrow(ValidationError);
    });

    it('should handle quota exceeded during import', async () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        const error = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });

      const importData = JSON.stringify({ key1: 'value1' });

      await expect(storageService.importData(importData))
        .rejects.toThrow(ServiceError);
    });
  });

  describe('getStorageQuota', () => {
    it('should return quota information when available', async () => {
      mockStorageEstimate.mockResolvedValue({
        quota: 1000000,
        usage: 500000
      });

      const result = await storageService.getStorageQuota();

      expect(result).toMatchObject({
        quota: 1000000,
        usage: 500000,
        available: 500000
      });
    });

    it('should return fallback values when storage API unavailable', async () => {
      // Remove storage API
      Object.defineProperty(navigator, 'storage', {
        value: undefined,
        configurable: true
      });

      const service = new LocalStorageService();
      const result = await service.getStorageQuota();

      expect(result).toMatchObject({
        quota: expect.any(Number),
        usage: expect.any(Number),
        available: expect.any(Number)
      });
    });

    it('should handle storage estimate errors', async () => {
      mockStorageEstimate.mockRejectedValue(new Error('Estimate failed'));

      const result = await storageService.getStorageQuota();

      expect(result).toMatchObject({
        quota: expect.any(Number),
        usage: expect.any(Number),
        available: expect.any(Number)
      });
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const isHealthy = await storageService.isHealthy();
      expect(isHealthy).toBe(true);
    });

    it('should return unhealthy when localStorage unavailable', async () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage not available');
      });

      const isHealthy = await storageService.isHealthy();
      expect(isHealthy).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle SecurityError', async () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        const error = new Error('SecurityError');
        error.name = 'SecurityError';
        throw error;
      });

      await expect(storageService.get('test-key'))
        .rejects.toThrow(ServiceError);
    });

    it('should handle DOMException', async () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        const error = new Error('DOMException');
        error.name = 'DOMException';
        throw error;
      });

      await expect(storageService.set('test-key', 'value'))
        .rejects.toThrow(ServiceError);
    });
  });

  describe('Validation', () => {
    it('should validate key format', async () => {
      await expect(storageService.get('key with spaces'))
        .rejects.toThrow(ValidationError);
    });

    it('should validate key length', async () => {
      const longKey = 'a'.repeat(256); // Assuming max length is 255
      
      await expect(storageService.get(longKey))
        .rejects.toThrow(ValidationError);
    });

    it('should validate value size', async () => {
      const largeValue = 'a'.repeat(10 * 1024 * 1024); // 10MB
      
      await expect(storageService.set('test-key', largeValue))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('Performance', () => {
    it('should handle large number of keys efficiently', async () => {
      const keys = Array.from({ length: 1000 }, (_, i) => `key${i}`);
      
      // Mock localStorage to return many keys
      mockLocalStorage.length = 1000;
      mockLocalStorage.key.mockImplementation((index) => 
        index < 1000 ? `pi-que-key${index}` : null
      );

      const start = Date.now();
      const result = await storageService.getKeys();
      const duration = Date.now() - start;

      expect(result).toHaveLength(1000);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle batch operations efficiently', async () => {
      const items: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        items[`key${i}`] = `value${i}`;
      }

      const start = Date.now();
      await storageService.setMultiple(items);
      const duration = Date.now() - start;

      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(100);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
}); 