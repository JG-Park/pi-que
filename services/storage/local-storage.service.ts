import {
  LocalStorageService as ILocalStorageService,
  StorageService,
  StorageInfo,
  StorageQuota,
  ServiceError,
  ValidationError
} from '../../types/services';

export class LocalStorageService implements ILocalStorageService {
  readonly serviceName = 'LocalStorageService';
  readonly version = '1.0.0';
  
  private readonly keyPrefix = 'pi-que-';
  
  constructor() {
    this.checkAvailability();
  }

  async isHealthy(): Promise<boolean> {
    try {
      const testKey = `${this.keyPrefix}health-check`;
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    this.validateKey(key);
    
    try {
      const item = localStorage.getItem(this.getPrefixedKey(key));
      if (item === null) {
        return null;
      }
      
      return JSON.parse(item);
    } catch (error) {
      throw new ServiceError('Failed to get item from localStorage', 'LocalStorageService', 'GET_ERROR', error as Error);
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.validateKey(key);
    this.validateValue(value);
    
    try {
      const serializedValue = JSON.stringify(value);
      localStorage.setItem(this.getPrefixedKey(key), serializedValue);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        throw new ServiceError('Storage quota exceeded', 'LocalStorageService', 'QUOTA_EXCEEDED', error);
      }
      throw new ServiceError('Failed to set item in localStorage', 'LocalStorageService', 'SET_ERROR', error as Error);
    }
  }

  async remove(key: string): Promise<void> {
    this.validateKey(key);
    
    try {
      localStorage.removeItem(this.getPrefixedKey(key));
    } catch (error) {
      throw new ServiceError('Failed to remove item from localStorage', 'LocalStorageService', 'REMOVE_ERROR', error as Error);
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = await this.getKeys();
      for (const key of keys) {
        await this.remove(key);
      }
    } catch (error) {
      throw new ServiceError('Failed to clear localStorage', 'LocalStorageService', 'CLEAR_ERROR', error as Error);
    }
  }

  async getKeys(): Promise<string[]> {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.keyPrefix)) {
          keys.push(key.substring(this.keyPrefix.length));
        }
      }
      return keys;
    } catch (error) {
      throw new ServiceError('Failed to get keys from localStorage', 'LocalStorageService', 'GET_KEYS_ERROR', error as Error);
    }
  }

  async exists(key: string): Promise<boolean> {
    this.validateKey(key);
    
    try {
      return localStorage.getItem(this.getPrefixedKey(key)) !== null;
    } catch (error) {
      throw new ServiceError('Failed to check if key exists in localStorage', 'LocalStorageService', 'EXISTS_ERROR', error as Error);
    }
  }

  async getMultiple<T>(keys: string[]): Promise<Record<string, T | null>> {
    if (!Array.isArray(keys)) {
      throw new ValidationError('LocalStorageService', 'keys', keys, 'array');
    }

    const result: Record<string, T | null> = {};
    
    for (const key of keys) {
      try {
        result[key] = await this.get<T>(key);
      } catch (error) {
        result[key] = null;
      }
    }

    return result;
  }

  async setMultiple<T>(items: Record<string, T>): Promise<void> {
    if (!items || typeof items !== 'object') {
      throw new ValidationError('LocalStorageService', 'items', items, 'object');
    }

    const errors: string[] = [];

    for (const [key, value] of Object.entries(items)) {
      try {
        await this.set(key, value);
      } catch (error) {
        errors.push(`Failed to set ${key}: ${(error as Error).message}`);
      }
    }

    if (errors.length > 0) {
      throw new ServiceError(`Failed to set multiple items: ${errors.join(', ')}`, 'LocalStorageService', 'SET_MULTIPLE_ERROR');
    }
  }

  async removeMultiple(keys: string[]): Promise<void> {
    if (!Array.isArray(keys)) {
      throw new ValidationError('LocalStorageService', 'keys', keys, 'array');
    }

    const errors: string[] = [];

    for (const key of keys) {
      try {
        await this.remove(key);
      } catch (error) {
        errors.push(`Failed to remove ${key}: ${(error as Error).message}`);
      }
    }

    if (errors.length > 0) {
      throw new ServiceError(`Failed to remove multiple items: ${errors.join(', ')}`, 'LocalStorageService', 'REMOVE_MULTIPLE_ERROR');
    }
  }

  async getStorageInfo(): Promise<StorageInfo> {
    try {
      const keys = await this.getKeys();
      let used = 0;
      
      // Calculate approximate size of stored data
      for (const key of keys) {
        const item = localStorage.getItem(this.getPrefixedKey(key));
        if (item) {
          used += new Blob([item]).size;
        }
      }

      // Get storage quota information
      const quota = await this.getStorageQuota();
      
      return {
        used,
        available: quota.available,
        total: quota.quota,
        itemCount: keys.length
      };
    } catch (error) {
      throw new ServiceError('Failed to get storage info', 'LocalStorageService', 'GET_STORAGE_INFO_ERROR', error as Error);
    }
  }

  // LocalStorageService specific methods
  async exportData(): Promise<string> {
    try {
      const keys = await this.getKeys();
      const data: Record<string, any> = {};
      
      for (const key of keys) {
        const value = await this.get(key);
        if (value !== null) {
          data[key] = value;
        }
      }

      return JSON.stringify({
        exportedAt: new Date().toISOString(),
        version: this.version,
        data
      }, null, 2);
    } catch (error) {
      throw new ServiceError('Failed to export data', 'LocalStorageService', 'EXPORT_ERROR', error as Error);
    }
  }

  async importData(data: string): Promise<void> {
    try {
      const importData = JSON.parse(data);
      
      if (!importData.data || typeof importData.data !== 'object') {
        throw new ValidationError('LocalStorageService', 'data', importData, 'valid export format');
      }

      // Clear existing data first (optional - you might want to make this configurable)
      await this.clear();

      // Import new data
      await this.setMultiple(importData.data);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError('Failed to import data', 'LocalStorageService', 'IMPORT_ERROR', error as Error);
    }
  }

  async getStorageQuota(): Promise<StorageQuota> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return {
          quota: estimate.quota || 0,
          usage: estimate.usage || 0,
          available: (estimate.quota || 0) - (estimate.usage || 0)
        };
      } else {
        // Fallback for browsers that don't support storage.estimate()
        // Estimate localStorage quota (usually 5-10MB)
        const testString = 'x'.repeat(1024); // 1KB string
        let quota = 0;
        
        try {
          for (let i = 0; i < 10240; i++) { // Test up to 10MB
            localStorage.setItem(`quota-test-${i}`, testString);
            quota += 1024;
          }
        } catch (e) {
          // Clean up test data
          for (let i = 0; i < 10240; i++) {
            localStorage.removeItem(`quota-test-${i}`);
          }
        }

        const info = await this.getStorageInfo();
        return {
          quota,
          usage: info.used,
          available: quota - info.used
        };
      }
    } catch (error) {
      throw new ServiceError('Failed to get storage quota', 'LocalStorageService', 'GET_QUOTA_ERROR', error as Error);
    }
  }

  // Private helper methods
  private checkAvailability(): void {
    try {
      if (typeof Storage === 'undefined' || !localStorage) {
        throw new ServiceError('localStorage is not available', 'LocalStorageService', 'NOT_AVAILABLE');
      }
    } catch (error) {
      throw new ServiceError('localStorage is not available', 'LocalStorageService', 'NOT_AVAILABLE', error as Error);
    }
  }

  private validateKey(key: string): void {
    if (!key || typeof key !== 'string') {
      throw new ValidationError('LocalStorageService', 'key', key, 'non-empty string');
    }
    
    if (key.length > 200) {
      throw new ValidationError('LocalStorageService', 'key', key, 'string (max 200 chars)');
    }
  }

  private validateValue<T>(value: T): void {
    if (value === undefined) {
      throw new ValidationError('LocalStorageService', 'value', value, 'any value except undefined');
    }

    try {
      JSON.stringify(value);
    } catch (error) {
      throw new ValidationError('LocalStorageService', 'value', value, 'JSON serializable value');
    }
  }

  private getPrefixedKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }
}

// Factory function
export const createLocalStorageService = (): LocalStorageService => {
  return new LocalStorageService();
};

// Singleton instance
let localStorageServiceInstance: LocalStorageService | null = null;

export const getLocalStorageService = (): LocalStorageService => {
  if (!localStorageServiceInstance) {
    localStorageServiceInstance = createLocalStorageService();
  }
  return localStorageServiceInstance;
}; 