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
  UseSegmentManagerState, 
  Segment, 
  BaseHookState 
} from '@/types/hooks';
import { ServiceError, ValidationError, NotFoundError } from '@/types/services';

// Enhanced error types for segment operations
export interface SegmentManagerError extends Error {
  code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT' | 'SERVICE_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN_ERROR';
  retryable: boolean;
  field?: string; // For validation errors
}

// Mock segment service with enhanced error handling
interface MockSegmentService {
  getSegments: (projectId: string) => Promise<{ items: Segment[] }>;
  createSegment: (projectId: string, segment: Partial<Segment>) => Promise<Segment>;
  updateSegment: (projectId: string, id: string, updates: Partial<Segment>) => Promise<Segment>;
  deleteSegment: (projectId: string, id: string) => Promise<void>;
}

// Performance optimization: Memoized mock service
const mockSegmentService: MockSegmentService = {
  getSegments: async (projectId: string) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Simulate occasional errors for testing
    if (Math.random() < 0.1) {
      throw new ServiceError('Network timeout', 'SegmentService', 'NETWORK_ERROR');
    }
    
    return {
      items: [
        {
          id: 'seg1',
          title: 'Introduction',
          description: 'Video introduction segment',
          startTime: 0,
          endTime: 30,
          tags: ['intro', 'welcome'],
        },
        {
          id: 'seg2',
          title: 'Main Content',
          description: 'Core video content',
          startTime: 30,
          endTime: 180,
          tags: ['content', 'main'],
        }
      ]
    };
  },
  createSegment: async (projectId: string, segment: Partial<Segment>) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Simulate validation errors
    if (!segment.title?.trim()) {
      throw new ValidationError('SegmentService', 'title', segment.title, 'non-empty string');
    }
    
    return {
      id: `seg_${Date.now()}`,
      title: segment.title!,
      description: segment.description || '',
      startTime: segment.startTime || 0,
      endTime: segment.endTime || 0,
      tags: segment.tags || [],
    };
  },
  updateSegment: async (projectId: string, id: string, updates: Partial<Segment>) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Simulate not found errors
    if (id === 'nonexistent') {
      throw new NotFoundError('SegmentService', 'segment', id);
    }
    
    return {
      id,
      title: updates.title || 'Updated Segment',
      description: updates.description || '',
      startTime: updates.startTime || 0,
      endTime: updates.endTime || 0,
      tags: updates.tags || [],
    };
  },
  deleteSegment: async (projectId: string, id: string) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Simulate not found errors
    if (id === 'nonexistent') {
      throw new NotFoundError('SegmentService', 'segment', id);
    }
  },
};

// React 18+: Enhanced segment manager hook with concurrent features
export const useSegmentManager = (projectId?: string): UseSegmentManagerState => {
  // React 18+: useTransition for non-urgent updates
  const [isPending, startTransition] = useTransition();

  // State management with enhanced error handling
  const [state, setState] = useState<BaseHookState>({
    isLoading: false,
    error: null,
    isSuccess: false,
  });

  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // React 18+: useDeferredValue for selection updates to reduce unnecessary re-renders
  const deferredSelectedIds = useDeferredValue(selectedIds);
  
  // Undo/Redo functionality with better memory management
  const history = useRef<Segment[][]>([]);
  const historyIndex = useRef(-1);
  const maxHistorySize = 20;

  // Operation tracking for optimistic updates
  const pendingOperations = useRef<Set<string>>(new Set());
  const abortController = useRef<AbortController | null>(null);

  // Performance optimization: Memoized error creation function
  const createError = useCallback((error: unknown, operation: string, field?: string): SegmentManagerError => {
    let code: SegmentManagerError['code'] = 'UNKNOWN_ERROR';
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
    } else if (error instanceof Error && (error.message.includes('network') || error.message.includes('fetch'))) {
      code = 'NETWORK_ERROR';
      retryable = true;
    }

    const segmentError = new Error(`${operation} failed: ${error instanceof Error ? error.message : 'Unknown error'}`) as SegmentManagerError;
    segmentError.code = code;
    segmentError.retryable = retryable;
    segmentError.field = field;
    
    return segmentError;
  }, []);

  // Performance optimization: Memoized history management
  const addToHistory = useCallback((newSegments: Segment[]) => {
    // Remove future history if we're not at the end
    if (historyIndex.current < history.current.length - 1) {
      history.current = history.current.slice(0, historyIndex.current + 1);
    }
    
    // Add new state
    history.current.push([...newSegments]);
    historyIndex.current = history.current.length - 1;
    
    // Limit history size
    if (history.current.length > maxHistorySize) {
      history.current = history.current.slice(-maxHistorySize);
      historyIndex.current = history.current.length - 1;
    }
  }, []);

  // Performance optimization: Memoized validation functions
  const validateSegment = useCallback((segment: Partial<Segment>): string | null => {
    if (!segment.title?.trim()) {
      return 'Title is required';
    }
    if (segment.startTime !== undefined && segment.endTime !== undefined) {
      if (segment.startTime < 0) {
        return 'Start time cannot be negative';
      }
      if (segment.endTime <= segment.startTime) {
        return 'End time must be greater than start time';
      }
    }
    return null;
  }, []);

  // React 18+: Enhanced load segments with concurrent features
  const loadSegments = useCallback(async (): Promise<void> => {
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
      const result = await mockSegmentService.getSegments(projectId);
      
      if (abortController.current?.signal.aborted) {
        return;
      }

      // React 18+: Use transition for segment updates
      startTransition(() => {
        setSegments(result.items);
        setState({
          isLoading: false,
          error: null,
          isSuccess: true,
        });
      });

      // Add to history
      addToHistory(result.items);
    } catch (error) {
      if (abortController.current?.signal.aborted) {
        return;
      }

      const segmentError = createError(error, 'Load segments');
      startTransition(() => {
        setState({
          isLoading: false,
          error: segmentError,
          isSuccess: false,
        });
      });
    }
  }, [projectId, createError, addToHistory]);

  // React 18+: Enhanced create segment with optimistic updates
  const create = useCallback(async (segment: Partial<Segment>): Promise<Segment> => {
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    const validationError = validateSegment(segment);
    if (validationError) {
      throw createError(new ValidationError('SegmentService', 'segment', segment, validationError), 'Create segment');
    }

    const tempId = `temp_${Date.now()}`;
    const optimisticSegment: Segment = {
      id: tempId,
      title: segment.title!,
      description: segment.description || '',
      startTime: segment.startTime || 0,
      endTime: segment.endTime || 0,
      tags: segment.tags || [],
    };

    // Optimistic update with transition
    startTransition(() => {
      setSegments(prev => produce(prev, draft => {
        draft.push(optimisticSegment);
      }));
      setState(prev => ({ ...prev, isLoading: true }));
    });

    pendingOperations.current.add(tempId);

    try {
      const newSegment = await mockSegmentService.createSegment(projectId, segment);
      
      // Replace optimistic segment with real one
      startTransition(() => {
        setSegments(prev => produce(prev, draft => {
          const index = draft.findIndex(s => s.id === tempId);
          if (index !== -1) {
            draft[index] = newSegment;
          }
        }));
        setState(prev => ({ ...prev, isLoading: false, isSuccess: true }));
      });

      pendingOperations.current.delete(tempId);
      addToHistory(segments);
      
      return newSegment;
    } catch (error) {
      // Rollback optimistic update
      startTransition(() => {
        setSegments(prev => prev.filter(s => s.id !== tempId));
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: createError(error, 'Create segment') 
        }));
      });

      pendingOperations.current.delete(tempId);
      throw createError(error, 'Create segment');
    }
  }, [projectId, validateSegment, createError, addToHistory, segments]);

  // React 18+: Enhanced update segment with optimistic updates
  const update = useCallback(async (id: string, updates: Partial<Segment>): Promise<Segment> => {
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    const existingSegment = segments.find(s => s.id === id);
    if (!existingSegment) {
      throw createError(new NotFoundError('SegmentService', 'segment', id), 'Update segment');
    }

    const proposedSegment = { ...existingSegment, ...updates };
    const validationError = validateSegment(proposedSegment);
    if (validationError) {
      throw createError(new ValidationError('SegmentService', 'segment', proposedSegment, validationError), 'Update segment');
    }

    // Optimistic update
    const previousSegments = [...segments];
    startTransition(() => {
      setSegments(prev => produce(prev, draft => {
        const index = draft.findIndex(s => s.id === id);
        if (index !== -1) {
          Object.assign(draft[index], updates);
        }
      }));
      setState(prev => ({ ...prev, isLoading: true }));
    });

    pendingOperations.current.add(id);

    try {
      const updatedSegment = await mockSegmentService.updateSegment(projectId, id, updates);
      
      // Confirm optimistic update
      startTransition(() => {
        setSegments(prev => produce(prev, draft => {
          const index = draft.findIndex(s => s.id === id);
          if (index !== -1) {
            draft[index] = updatedSegment;
          }
        }));
        setState(prev => ({ ...prev, isLoading: false, isSuccess: true }));
      });

      pendingOperations.current.delete(id);
      addToHistory(previousSegments);
      
      return updatedSegment;
    } catch (error) {
      // Rollback optimistic update
      startTransition(() => {
        setSegments(previousSegments);
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: createError(error, 'Update segment') 
        }));
      });

      pendingOperations.current.delete(id);
      throw createError(error, 'Update segment');
    }
  }, [projectId, segments, validateSegment, createError, addToHistory]);

  // React 18+: Enhanced delete segment with optimistic updates
  const deleteSegment = useCallback(async (id: string): Promise<void> => {
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    const existingSegment = segments.find(s => s.id === id);
    if (!existingSegment) {
      throw createError(new NotFoundError('SegmentService', 'segment', id), 'Delete segment');
    }

    // Optimistic update
    const previousSegments = [...segments];
    startTransition(() => {
      setSegments(prev => prev.filter(s => s.id !== id));
      setSelectedIds(prev => prev.filter(sid => sid !== id));
      setState(prev => ({ ...prev, isLoading: true }));
    });

    pendingOperations.current.add(id);

    try {
      await mockSegmentService.deleteSegment(projectId, id);
      
      startTransition(() => {
        setState(prev => ({ ...prev, isLoading: false, isSuccess: true }));
      });

      pendingOperations.current.delete(id);
      addToHistory(previousSegments);
    } catch (error) {
      // Rollback optimistic update
      startTransition(() => {
        setSegments(previousSegments);
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: createError(error, 'Delete segment') 
        }));
      });

      pendingOperations.current.delete(id);
      throw createError(error, 'Delete segment');
    }
  }, [projectId, segments, createError, addToHistory]);

  // Performance optimization: Memoized selection management
  const selectSegment = useCallback((id: string, multiSelect = false): void => {
    startTransition(() => {
      setSelectedIds(prev => {
        if (multiSelect) {
          return prev.includes(id) 
            ? prev.filter(sid => sid !== id)
            : [...prev, id];
        }
        return [id];
      });
    });
  }, []);

  const clearSelection = useCallback((): void => {
    startTransition(() => {
      setSelectedIds([]);
    });
  }, []);

  // Load segments when projectId changes
  useEffect(() => {
    if (projectId) {
      loadSegments();
    }
  }, [projectId, loadSegments]);

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
    segments,
    selectedIds: deferredSelectedIds, // Use deferred value for better performance
    isPending, // React 18+: Expose pending state
    create,
    update,
    delete: deleteSegment,
    selectSegment,
    clearSelection,
    // Additional utility methods
    loadSegments,
  }), [
    state, 
    segments, 
    deferredSelectedIds, 
    isPending,
    create, 
    update, 
    deleteSegment, 
    selectSegment, 
    clearSelection,
    loadSegments
  ]);
}; 