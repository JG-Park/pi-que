import { 
  useState, 
  useCallback, 
  useRef, 
  useEffect, 
  useMemo,
  useTransition,
  useDeferredValue,
  startTransition 
} from 'react';
import { produce } from 'immer';
import { 
  UseQueueManagerState, 
  QueueItem, 
  Segment, 
  BaseHookState 
} from '@/types/hooks';
import { ServiceError, ValidationError, NotFoundError } from '@/types/services';

// Enhanced error types for queue operations
export interface QueueManagerError extends Error {
  code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT' | 'SERVICE_ERROR' | 'PLAYBACK_ERROR' | 'UNKNOWN_ERROR';
  retryable: boolean;
  context?: string; // Additional context for debugging
}

// Performance optimization: Memoized mock queue service
interface MockQueueService {
  getQueue: (projectId: string) => Promise<{ items: QueueItem[] }>;
  addToQueue: (projectId: string, segmentId: string) => Promise<QueueItem>;
  removeFromQueue: (projectId: string, queueItemId: string) => Promise<void>;
  reorderQueue: (projectId: string, items: QueueItem[]) => Promise<QueueItem[]>;
}

const mockQueueService: MockQueueService = {
  getQueue: async (projectId: string) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Simulate occasional errors
    if (Math.random() < 0.05) {
      throw new ServiceError('Queue service temporarily unavailable', 'QueueService', 'SERVICE_UNAVAILABLE');
    }
    
    return {
      items: [
        {
          id: 'q1',
          segmentId: 'seg1',
          segment: {
            id: 'seg1',
            title: 'Introduction',
            description: 'Opening segment',
            startTime: 0,
            endTime: 30,
            tags: ['intro'],
          },
          order: 1,
        },
        {
          id: 'q2',
          segmentId: 'seg2',
          segment: {
            id: 'seg2',
            title: 'Main Content',
            description: 'Primary content',
            startTime: 30,
            endTime: 180,
            tags: ['main'],
          },
          order: 2,
        }
      ]
    };
  },
  
  addToQueue: async (projectId: string, segmentId: string) => {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    return {
      id: `q_${Date.now()}`,
      segmentId,
      segment: {
        id: segmentId,
        title: 'New Segment',
        description: 'Newly added segment',
        startTime: 0,
        endTime: 60,
        tags: [],
      },
      order: Date.now(),
    };
  },
  
  removeFromQueue: async (projectId: string, queueItemId: string) => {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    if (queueItemId === 'nonexistent') {
      throw new NotFoundError('QueueService', 'queue item', queueItemId);
    }
  },
  
  reorderQueue: async (projectId: string, items: QueueItem[]) => {
    await new Promise(resolve => setTimeout(resolve, 250));
    return items.map((item, index) => ({ ...item, order: index + 1 }));
  },
};

// React 18+: Enhanced queue manager hook with concurrent features
export const useQueueManager = (projectId?: string): UseQueueManagerState => {
  // React 18+: useTransition for non-urgent updates
  const [isPending, startTransition] = useTransition();

  // State management with enhanced error handling
  const [state, setState] = useState<BaseHookState>({
    isLoading: false,
    error: null,
    isSuccess: false,
  });

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentItem, setCurrentItem] = useState<QueueItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // React 18+: useDeferredValue for queue updates to reduce re-renders during drag operations
  const deferredQueue = useDeferredValue(queue);
  
  // Playback and operation management
  const retryCount = useRef<number>(0);
  const maxRetries = 3;
  const abortController = useRef<AbortController | null>(null);
  const pendingOperations = useRef<Set<string>>(new Set());

  // Performance optimization: Memoized error creation function
  const createError = useCallback((error: unknown, operation: string, context?: string): QueueManagerError => {
    let code: QueueManagerError['code'] = 'UNKNOWN_ERROR';
    let retryable = false;

    if (error instanceof ValidationError) {
      code = 'VALIDATION_ERROR';
      retryable = false;
    } else if (error instanceof NotFoundError) {
      code = 'NOT_FOUND';
      retryable = false;
    } else if (error instanceof ServiceError) {
      if (error.errorCode === 'CONFLICT') {
        code = 'CONFLICT';
        retryable = false;
      } else {
        code = 'SERVICE_ERROR';
        retryable = true;
      }
    } else if (error instanceof Error && error.message.includes('playback')) {
      code = 'PLAYBACK_ERROR';
      retryable = true;
    }

    const queueError = new Error(`${operation} failed: ${error instanceof Error ? error.message : 'Unknown error'}`) as QueueManagerError;
    queueError.code = code;
    queueError.retryable = retryable;
    queueError.context = context;
    
    return queueError;
  }, []);

  // React 18+: Enhanced load queue with concurrent features
  const loadQueue = useCallback(async (): Promise<void> => {
    if (!projectId) return;

    // Cancel previous request
    if (abortController.current) {
      abortController.current.abort();
    }
    abortController.current = new AbortController();

    startTransition(() => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
    });

    try {
      const result = await mockQueueService.getQueue(projectId);
      
      if (abortController.current?.signal.aborted) {
        return;
      }

      // React 18+: Use transition for queue updates
      startTransition(() => {
        setQueue(result.items);
        setState({
          isLoading: false,
          error: null,
          isSuccess: true,
        });
      });

      retryCount.current = 0;
    } catch (error) {
      if (abortController.current?.signal.aborted) {
        return;
      }

      const queueError = createError(error, 'Load queue');
      
      // Retry logic for retryable errors
      if (queueError.retryable && retryCount.current < maxRetries) {
        retryCount.current++;
        setTimeout(() => loadQueue(), 1000 * retryCount.current);
        return;
      }

      startTransition(() => {
        setState({
          isLoading: false,
          error: queueError,
          isSuccess: false,
        });
      });
    }
  }, [projectId, createError]);

  // React 18+: Enhanced add to queue with optimistic updates
  const add = useCallback(async (segmentId: string): Promise<QueueItem> => {
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    if (!segmentId.trim()) {
      throw createError(new ValidationError('QueueService', 'segmentId', segmentId, 'non-empty string'), 'Add to queue');
    }

    const tempId = `temp_${Date.now()}`;
    const optimisticItem: QueueItem = {
      id: tempId,
      segmentId,
      segment: {
        id: segmentId,
        title: 'Loading...',
        description: '',
        startTime: 0,
        endTime: 0,
        tags: [],
      },
      order: queue.length + 1,
    };

    // Optimistic update
    startTransition(() => {
      setQueue(prev => [...prev, optimisticItem]);
      setState(prev => ({ ...prev, isLoading: true }));
    });

    pendingOperations.current.add(tempId);

    try {
      const newItem = await mockQueueService.addToQueue(projectId, segmentId);
      
      // Replace optimistic item with real one
      startTransition(() => {
        setQueue(prev => produce(prev, draft => {
          const index = draft.findIndex(item => item.id === tempId);
          if (index !== -1) {
            draft[index] = newItem;
          }
        }));
        setState(prev => ({ ...prev, isLoading: false, isSuccess: true }));
      });

      pendingOperations.current.delete(tempId);
      return newItem;
    } catch (error) {
      // Rollback optimistic update
      startTransition(() => {
        setQueue(prev => prev.filter(item => item.id !== tempId));
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: createError(error, 'Add to queue') 
        }));
      });

      pendingOperations.current.delete(tempId);
      throw createError(error, 'Add to queue');
    }
  }, [projectId, queue.length, createError]);

  // React 18+: Enhanced remove from queue with optimistic updates
  const remove = useCallback(async (id: string): Promise<void> => {
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    const existingItem = queue.find(item => item.id === id);
    if (!existingItem) {
      throw createError(new NotFoundError('QueueService', 'queue item', id), 'Remove from queue');
    }

    // Optimistic update
    const previousQueue = [...queue];
    startTransition(() => {
      setQueue(prev => prev.filter(item => item.id !== id));
      
      // If removing current item, stop playback
      if (currentItem?.id === id) {
        setCurrentItem(null);
        setIsPlaying(false);
      }
      
      setState(prev => ({ ...prev, isLoading: true }));
    });

    pendingOperations.current.add(id);

    try {
      await mockQueueService.removeFromQueue(projectId, id);
      
      startTransition(() => {
        setState(prev => ({ ...prev, isLoading: false, isSuccess: true }));
      });

      pendingOperations.current.delete(id);
    } catch (error) {
      // Rollback optimistic update
      startTransition(() => {
        setQueue(previousQueue);
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: createError(error, 'Remove from queue') 
        }));
      });

      pendingOperations.current.delete(id);
      throw createError(error, 'Remove from queue');
    }
  }, [projectId, queue, currentItem, createError]);

  // Performance optimization: Memoized playback controls
  const play = useCallback(async (id?: string): Promise<void> => {
    const targetItem = id ? queue.find(item => item.id === id) : (currentItem || queue[0]);
    
    if (!targetItem) {
      throw createError(new Error('No item to play'), 'Play', 'Empty queue or invalid item');
    }

    startTransition(() => {
      setCurrentItem(targetItem);
      setIsPlaying(true);
      setState(prev => ({ ...prev, error: null }));
    });
  }, [queue, currentItem, createError]);

  const pause = useCallback((): void => {
    startTransition(() => {
      setIsPlaying(false);
    });
  }, []);

  const next = useCallback(async (): Promise<QueueItem | null> => {
    if (!currentItem) return null;

    const currentIndex = queue.findIndex(item => item.id === currentItem.id);
    const nextItem = queue[currentIndex + 1] || null;

    startTransition(() => {
      setCurrentItem(nextItem);
      setIsPlaying(!!nextItem);
    });

    return nextItem;
  }, [queue, currentItem]);

  const previous = useCallback(async (): Promise<QueueItem | null> => {
    if (!currentItem) return null;

    const currentIndex = queue.findIndex(item => item.id === currentItem.id);
    const prevItem = queue[currentIndex - 1] || null;

    startTransition(() => {
      setCurrentItem(prevItem);
      setIsPlaying(!!prevItem);
    });

    return prevItem;
  }, [queue, currentItem]);

  // Load queue when projectId changes
  useEffect(() => {
    if (projectId) {
      loadQueue();
    }
  }, [projectId, loadQueue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
      pendingOperations.current.clear();
    };
  }, []);

  // Performance optimization: Memoized return value with deferred values
  return useMemo(() => ({
    ...state,
    queue: deferredQueue, // Use deferred value for better performance during drag operations
    currentItem,
    isPlaying,
    isPending, // React 18+: Expose pending state
    add,
    remove,
    play,
    pause,
    next,
    previous,
    // Additional utility methods
    loadQueue,
  }), [
    state, 
    deferredQueue, 
    currentItem, 
    isPlaying, 
    isPending,
    add, 
    remove, 
    play, 
    pause, 
    next, 
    previous,
    loadQueue
  ]);
}; 