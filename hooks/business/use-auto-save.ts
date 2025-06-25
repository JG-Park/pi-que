import { 
  useState, 
  useEffect, 
  useCallback, 
  useRef, 
  useMemo,
  useTransition,
  useDeferredValue,
  startTransition 
} from 'react';
import { debounce } from 'lodash';
import { 
  UseAutoSaveState, 
  AutoSaveOptions, 
  BaseHookState 
} from '@/types/hooks';
import { ServiceError, ValidationError } from '@/types/services';

// Enhanced error types for auto-save operations
export interface AutoSaveError extends Error {
  code: 'VALIDATION_ERROR' | 'STORAGE_QUOTA_EXCEEDED' | 'NETWORK_ERROR' | 'OFFLINE' | 'SERVICE_ERROR' | 'UNKNOWN_ERROR';
  retryable: boolean;
  retryAfter?: number; // seconds
  context?: string;
}

// Extended auto-save configuration options
export interface ExtendedAutoSaveOptions {
  delay?: number; // debounce delay in milliseconds
  maxRetries?: number;
  enabled?: boolean;
  onSave?: (data: any) => Promise<void>;
  onError?: (error: AutoSaveError) => void;
  onSuccess?: () => void;
  validateData?: (data: any) => boolean;
  maxDataSize?: number; // in bytes
}

// Network status monitoring
const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};

// Performance optimization: Memoized mock storage service
interface MockStorageService {
  save: (data: any) => Promise<void>;
  getStorageQuota: () => Promise<{ used: number; available: number }>;
}

const mockStorageService: MockStorageService = {
  save: async (data: any) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Simulate occasional errors
    if (Math.random() < 0.1) {
      throw new ServiceError('Storage service temporarily unavailable', 'StorageService', 'SERVICE_UNAVAILABLE');
    }
    
    // Simulate storage quota issues
    if (JSON.stringify(data).length > 100000) {
      throw new ServiceError('Storage quota exceeded', 'StorageService', 'QUOTA_EXCEEDED');
    }
  },
  
  getStorageQuota: async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      used: Math.floor(Math.random() * 80000000), // Random used space
      available: 100000000 // 100MB available
    };
  }
};

// React 18+: Enhanced auto-save hook with concurrent features
export const useAutoSave = (
  data: any,
  options: ExtendedAutoSaveOptions = {}
): UseAutoSaveState => {
  // React 18+: useTransition for non-urgent save operations
  const [isPending, startTransition] = useTransition();

  const {
    delay = 2000,
    maxRetries = 3,
    enabled = true,
    onSave,
    onError,
    onSuccess,
    validateData,
    maxDataSize = 50 * 1024 * 1024 // 50MB default
  } = options;

  // State management with enhanced error handling
  const [state, setState] = useState<BaseHookState>({
    isLoading: false,
    error: null,
    isSuccess: false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isEnabled, setIsEnabled] = useState(enabled);

  // React 18+: useDeferredValue for data to reduce unnecessary save operations
  const deferredData = useDeferredValue(data);

  // Network status monitoring
  const isOnline = useNetworkStatus();

  // Refs for managing retries and state
  const retryCount = useRef<number>(0);
  const lastSavedData = useRef<any>(null);
  const offlineQueue = useRef<any[]>([]);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Performance optimization: Memoized error creation function
  const createError = useCallback((
    error: unknown, 
    operation: string, 
    context?: string
  ): AutoSaveError => {
    let code: AutoSaveError['code'] = 'UNKNOWN_ERROR';
    let retryable = false;
    let retryAfter: number | undefined;

    if (error instanceof ServiceError) {
      if (error.errorCode === 'QUOTA_EXCEEDED') {
        code = 'STORAGE_QUOTA_EXCEEDED';
        retryable = false;
      } else if (error.errorCode === 'SERVICE_UNAVAILABLE') {
        code = 'SERVICE_ERROR';
        retryable = true;
        retryAfter = Math.min(Math.pow(2, retryCount.current), 30);
      }
    } else if (!isOnline) {
      code = 'OFFLINE';
      retryable = true;
      retryAfter = 5;
    } else if (error instanceof Error && error.message.includes('network')) {
      code = 'NETWORK_ERROR';
      retryable = true;
      retryAfter = 5;
    }

    const autoSaveError = new Error(`${operation} failed: ${error instanceof Error ? error.message : 'Unknown error'}`) as AutoSaveError;
    autoSaveError.code = code;
    autoSaveError.retryable = retryable;
    autoSaveError.retryAfter = retryAfter;
    autoSaveError.context = context;
    
    return autoSaveError;
  }, [isOnline]);

  // Performance optimization: Memoized validation function
  const isDataValid = useCallback((dataToValidate: any): boolean => {
    if (validateData && !validateData(dataToValidate)) {
      return false;
    }

    // Check data size
    const dataSize = new Blob([JSON.stringify(dataToValidate)]).size;
    if (dataSize > maxDataSize) {
      return false;
    }

    return true;
  }, [validateData, maxDataSize]);

  // React 18+: Enhanced save function with concurrent features
  const performSave = useCallback(async (
    dataToSave: any, 
    isManualSave = false
  ): Promise<void> => {
    if (!isEnabled && !isManualSave) return;

    // Validate data
    if (!isDataValid(dataToSave)) {
      const error = createError(new Error('Invalid data'), 'Data validation', 'Data failed validation checks');
      if (onError) onError(error);
      throw error;
    }

    // Check storage quota
    try {
      const quota = await mockStorageService.getStorageQuota();
      const dataSize = new Blob([JSON.stringify(dataToSave)]).size;
      
      if (quota.used + dataSize > quota.available) {
        const error = createError(new Error('Storage quota exceeded'), 'Storage check');
        if (onError) onError(error);
        throw error;
      }
    } catch (quotaError) {
      // Continue with save if quota check fails
      console.warn('Could not check storage quota:', quotaError);
    }

    startTransition(() => {
      setIsSaving(true);
      setState(prev => ({ ...prev, isLoading: true, error: null }));
    });

    try {
      if (onSave) {
        await onSave(dataToSave);
      } else {
        await mockStorageService.save(dataToSave);
      }

      // Success handling with transition
      startTransition(() => {
        setIsSaving(false);
        setLastSavedAt(new Date());
        setHasUnsavedChanges(false);
        setState({
          isLoading: false,
          error: null,
          isSuccess: true,
        });
      });

      lastSavedData.current = dataToSave;
      retryCount.current = 0;

      if (onSuccess) onSuccess();
    } catch (error) {
      const saveError = createError(error, 'Auto-save');

      // Add to offline queue if offline
      if (!isOnline) {
        offlineQueue.current.push(dataToSave);
        
        startTransition(() => {
          setIsSaving(false);
          setState(prev => ({ 
            ...prev, 
            isLoading: false,
            error: saveError
          }));
        });
        return;
      }

      // Retry logic for retryable errors
      if (saveError.retryable && retryCount.current < maxRetries) {
        retryCount.current++;
        const retryDelay = saveError.retryAfter ? saveError.retryAfter * 1000 : 1000;
        
        setTimeout(() => {
          performSave(dataToSave, isManualSave);
        }, retryDelay);
        
        return;
      }

      // Final error handling
      startTransition(() => {
        setIsSaving(false);
        setState({
          isLoading: false,
          error: saveError,
          isSuccess: false,
        });
      });

      if (onError) onError(saveError);
      throw saveError;
    }
  }, [
    isEnabled, 
    isDataValid, 
    createError, 
    onSave, 
    onError, 
    onSuccess, 
    isOnline, 
    maxRetries
  ]);

  // Performance optimization: Memoized debounced save function
  const debouncedSave = useMemo(
    () => debounce((dataToSave: any) => {
      if (dataToSave && JSON.stringify(dataToSave) !== JSON.stringify(lastSavedData.current)) {
        performSave(dataToSave);
      }
    }, delay),
    [performSave, delay]
  );

  // Manual save function
  const save = useCallback(async (dataToSave?: any): Promise<void> => {
    const saveData = dataToSave || deferredData;
    await performSave(saveData, true);
  }, [performSave, deferredData]);

  // React 18+: Process offline queue when coming back online
  useEffect(() => {
    if (isOnline && offlineQueue.current.length > 0) {
      const processOfflineQueue = async () => {
        const queuedItems = [...offlineQueue.current];
        offlineQueue.current = [];

        for (const queuedData of queuedItems) {
          try {
            await performSave(queuedData);
          } catch (error) {
            // Re-queue if save fails
            offlineQueue.current.push(queuedData);
            break;
          }
        }
      };

      // Use a small delay to ensure network is stable
      const timeout = setTimeout(processOfflineQueue, 1000);
      return () => clearTimeout(timeout);
    }
  }, [isOnline, performSave]);

  // Auto-save trigger with deferred data
  useEffect(() => {
    if (deferredData && isEnabled) {
      setHasUnsavedChanges(true);
      debouncedSave(deferredData);
    }

    return () => {
      debouncedSave.cancel();
    };
  }, [deferredData, isEnabled, debouncedSave]);

  // Enhanced page unload warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges || isSaving) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges, isSaving]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      debouncedSave.cancel();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [debouncedSave]);

  // Performance optimization: Memoized return value
  return useMemo(() => ({
    ...state,
    isSaving,
    lastSavedAt,
    hasUnsavedChanges,
    isPending,
    save,
    setEnabled: useCallback((enabled: boolean) => {
      startTransition(() => {
        setIsEnabled(enabled);
      });
    }, []),
  }), [
    state,
    isSaving,
    lastSavedAt,
    hasUnsavedChanges,
    isPending,
    save
  ]);
}; 