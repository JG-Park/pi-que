import { QueueService } from '../queue.service';
import { createQueueService, getQueueService } from '../queue.service';
import { 
  QueueItem, 
  AddQueueItemRequest, 
  QueueState, 
  Segment,
  ValidationError, 
  NotFoundError, 
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

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

describe('QueueService', () => {
  let queueService: QueueService;
  
  const mockSegment: Segment = {
    id: 'segment-1',
    title: 'Test Segment',
    description: 'A test segment',
    startTime: 10,
    endTime: 30,
    tags: ['test'],
    metadata: {
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
      order: 1,
      duration: 20
    },
    settings: {
      autoPlay: false,
      loop: false,
      volume: 100,
      playbackRate: 1.0,
      fadeIn: 0,
      fadeOut: 0
    }
  };

  const mockQueueItem: QueueItem = {
    id: 'queue-item-1',
    segmentId: 'segment-1',
    segment: mockSegment,
    order: 1,
    metadata: {
      addedAt: new Date('2024-01-01'),
      playCount: 0
    }
  };

  const mockQueueState: QueueState = {
    currentItemId: null,
    currentPosition: 0,
    isPlaying: false,
    isLooping: false,
    isShuffled: false,
    repeatMode: 'none'
  };

  const projectId = 'test-project-1';

  beforeEach(() => {
    queueService = new QueueService();
    jest.clearAllMocks();
    mockLocalStorage.length = 0;
  });

  describe('Constructor and Factory', () => {
    it('should create instance with default options', () => {
      expect(queueService).toBeInstanceOf(QueueService);
      expect(queueService.isHealthy()).resolves.toBe(true);
    });

    it('should create instance via factory function', () => {
      const service = createQueueService();
      expect(service).toBeInstanceOf(QueueService);
    });

    it('should return singleton instance', () => {
      const service1 = getQueueService();
      const service2 = getQueueService();
      expect(service1).toBe(service2);
    });
  });

  describe('addToQueue', () => {
    it('should add item to queue successfully', async () => {
      const queueData: AddQueueItemRequest = {
        segmentId: 'segment-1',
        position: 1
      };

      const projectQueues = { [projectId]: [] };
      const projectSegments = { [projectId]: [mockSegment] };
      
      mockLocalStorage.getItem
        .mockReturnValueOnce(JSON.stringify(projectQueues)) // queue data
        .mockReturnValueOnce(JSON.stringify(projectSegments)); // segment data

      const result = await queueService.addToQueue(projectId, queueData);

      expect(result).toMatchObject({
        segmentId: queueData.segmentId,
        order: 1
      });
      expect(result.id).toBeDefined();
      expect(result.metadata.addedAt).toBeInstanceOf(Date);
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should add item to end of queue when position not specified', async () => {
      const queueData: AddQueueItemRequest = {
        segmentId: 'segment-1'
      };

      const existingQueue = [mockQueueItem];
      const projectQueues = { [projectId]: existingQueue };
      const projectSegments = { [projectId]: [mockSegment] };
      
      mockLocalStorage.getItem
        .mockReturnValueOnce(JSON.stringify(projectQueues))
        .mockReturnValueOnce(JSON.stringify(projectSegments));

      const result = await queueService.addToQueue(projectId, queueData);

      expect(result.order).toBe(2); // Should be added after existing item
    });

    it('should throw NotFoundError for non-existent segment', async () => {
      const queueData: AddQueueItemRequest = {
        segmentId: 'non-existent-segment'
      };

      mockLocalStorage.getItem
        .mockReturnValueOnce(JSON.stringify({}))
        .mockReturnValueOnce(JSON.stringify({}));

      await expect(queueService.addToQueue(projectId, queueData))
        .rejects.toThrow(NotFoundError);
    });

    it('should handle localStorage errors', async () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const queueData: AddQueueItemRequest = {
        segmentId: 'segment-1'
      };

      await expect(queueService.addToQueue(projectId, queueData))
        .rejects.toThrow(ServiceError);
    });
  });

  describe('removeFromQueue', () => {
    beforeEach(() => {
      const projectQueues = { [projectId]: [mockQueueItem] };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projectQueues));
    });

    it('should remove item from queue successfully', async () => {
      await queueService.removeFromQueue(projectId, 'queue-item-1');

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should throw NotFoundError for non-existent queue item', async () => {
      await expect(queueService.removeFromQueue(projectId, 'non-existent'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('clearQueue', () => {
    beforeEach(() => {
      const projectQueues = { [projectId]: [mockQueueItem] };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projectQueues));
    });

    it('should clear all items from queue', async () => {
      await queueService.clearQueue(projectId);

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('getQueue', () => {
    it('should return queue items for project', async () => {
      const queueItems = [mockQueueItem];
      const projectQueues = { [projectId]: queueItems };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projectQueues));

      const result = await queueService.getQueue(projectId);

      expect(result).toEqual(queueItems);
    });

    it('should return empty array when no queue exists', async () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({}));

      const result = await queueService.getQueue(projectId);

      expect(result).toEqual([]);
    });

    it('should handle corrupted localStorage data', async () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');

      await expect(queueService.getQueue(projectId))
        .rejects.toThrow(ServiceError);
    });
  });

  describe('reorderQueue', () => {
    const queueItem2 = { 
      ...mockQueueItem, 
      id: 'queue-item-2', 
      order: 2,
      segmentId: 'segment-2'
    };
    
    beforeEach(() => {
      const projectQueues = { [projectId]: [mockQueueItem, queueItem2] };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projectQueues));
    });

    it('should reorder queue items successfully', async () => {
      await queueService.reorderQueue(projectId, ['queue-item-2', 'queue-item-1']);

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should throw ValidationError for invalid item IDs', async () => {
      await expect(queueService.reorderQueue(projectId, ['non-existent']))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('moveQueueItem', () => {
    const queueItem2 = { 
      ...mockQueueItem, 
      id: 'queue-item-2', 
      order: 2,
      segmentId: 'segment-2'
    };
    
    beforeEach(() => {
      const projectQueues = { [projectId]: [mockQueueItem, queueItem2] };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projectQueues));
    });

    it('should move queue item to new position', async () => {
      await queueService.moveQueueItem(projectId, 'queue-item-1', 2);

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should throw NotFoundError for non-existent item', async () => {
      await expect(queueService.moveQueueItem(projectId, 'non-existent', 1))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for invalid position', async () => {
      await expect(queueService.moveQueueItem(projectId, 'queue-item-1', -1))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('playNext', () => {
    beforeEach(() => {
      const queueItem2 = { 
        ...mockQueueItem, 
        id: 'queue-item-2', 
        order: 2,
        segmentId: 'segment-2'
      };
      const projectQueues = { [projectId]: [mockQueueItem, queueItem2] };
      const projectStates = { 
        [projectId]: { 
          ...mockQueueState, 
          currentItemId: 'queue-item-1',
          currentPosition: 0
        } 
      };
      
      mockLocalStorage.getItem
        .mockReturnValueOnce(JSON.stringify(projectQueues))
        .mockReturnValueOnce(JSON.stringify(projectStates));
    });

    it('should play next item in queue', async () => {
      const result = await queueService.playNext(projectId);

      expect(result).toBeDefined();
      expect(result?.id).toBe('queue-item-2');
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should return null when at end of queue', async () => {
      const projectStates = { 
        [projectId]: { 
          ...mockQueueState, 
          currentItemId: 'queue-item-2',
          currentPosition: 1
        } 
      };
      
      mockLocalStorage.getItem
        .mockReturnValueOnce(JSON.stringify({ [projectId]: [mockQueueItem] }))
        .mockReturnValueOnce(JSON.stringify(projectStates));

      const result = await queueService.playNext(projectId);

      expect(result).toBeNull();
    });
  });

  describe('playPrevious', () => {
    beforeEach(() => {
      const queueItem2 = { 
        ...mockQueueItem, 
        id: 'queue-item-2', 
        order: 2,
        segmentId: 'segment-2'
      };
      const projectQueues = { [projectId]: [mockQueueItem, queueItem2] };
      const projectStates = { 
        [projectId]: { 
          ...mockQueueState, 
          currentItemId: 'queue-item-2',
          currentPosition: 1
        } 
      };
      
      mockLocalStorage.getItem
        .mockReturnValueOnce(JSON.stringify(projectQueues))
        .mockReturnValueOnce(JSON.stringify(projectStates));
    });

    it('should play previous item in queue', async () => {
      const result = await queueService.playPrevious(projectId);

      expect(result).toBeDefined();
      expect(result?.id).toBe('queue-item-1');
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should return null when at beginning of queue', async () => {
      const projectStates = { 
        [projectId]: { 
          ...mockQueueState, 
          currentItemId: 'queue-item-1',
          currentPosition: 0
        } 
      };
      
      mockLocalStorage.getItem
        .mockReturnValueOnce(JSON.stringify({ [projectId]: [mockQueueItem] }))
        .mockReturnValueOnce(JSON.stringify(projectStates));

      const result = await queueService.playPrevious(projectId);

      expect(result).toBeNull();
    });
  });

  describe('playItem', () => {
    beforeEach(() => {
      const projectQueues = { [projectId]: [mockQueueItem] };
      const projectStates = { [projectId]: mockQueueState };
      
      mockLocalStorage.getItem
        .mockReturnValueOnce(JSON.stringify(projectQueues))
        .mockReturnValueOnce(JSON.stringify(projectStates));
    });

    it('should play specific item', async () => {
      await queueService.playItem(projectId, 'queue-item-1');

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should throw NotFoundError for non-existent item', async () => {
      await expect(queueService.playItem(projectId, 'non-existent'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('getQueueState', () => {
    it('should return queue state for project', async () => {
      const projectStates = { [projectId]: mockQueueState };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projectStates));

      const result = await queueService.getQueueState(projectId);

      expect(result).toEqual(mockQueueState);
    });

    it('should return default state when no state exists', async () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({}));

      const result = await queueService.getQueueState(projectId);

      expect(result.currentItemId).toBeNull();
      expect(result.isPlaying).toBe(false);
      expect(result.repeatMode).toBe('none');
    });
  });

  describe('updateQueueState', () => {
    beforeEach(() => {
      const projectStates = { [projectId]: mockQueueState };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projectStates));
    });

    it('should update queue state successfully', async () => {
      const updates = {
        isPlaying: true,
        currentItemId: 'queue-item-1',
        repeatMode: 'one' as const
      };

      const result = await queueService.updateQueueState(projectId, updates);

      expect(result.isPlaying).toBe(true);
      expect(result.currentItemId).toBe('queue-item-1');
      expect(result.repeatMode).toBe('one');
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should validate state updates', async () => {
      const invalidUpdates = {
        repeatMode: 'invalid' as any
      };

      await expect(queueService.updateQueueState(projectId, invalidUpdates))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const isHealthy = await queueService.isHealthy();
      expect(isHealthy).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle localStorage quota exceeded', async () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        const error = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });

      const queueData: AddQueueItemRequest = {
        segmentId: 'segment-1'
      };

      const projectSegments = { [projectId]: [mockSegment] };
      mockLocalStorage.getItem
        .mockReturnValueOnce(JSON.stringify({}))
        .mockReturnValueOnce(JSON.stringify(projectSegments));

      await expect(queueService.addToQueue(projectId, queueData))
        .rejects.toThrow(ServiceError);
    });

    it('should handle localStorage access denied', async () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Access denied');
      });

      await expect(queueService.getQueue(projectId))
        .rejects.toThrow(ServiceError);
    });
  });

  describe('Validation', () => {
    it('should validate project ID', async () => {
      await expect(queueService.getQueue(''))
        .rejects.toThrow(ValidationError);
    });

    it('should validate queue item position', async () => {
      const queueData: AddQueueItemRequest = {
        segmentId: 'segment-1',
        position: -1 // Invalid negative position
      };

      const projectSegments = { [projectId]: [mockSegment] };
      mockLocalStorage.getItem
        .mockReturnValueOnce(JSON.stringify({}))
        .mockReturnValueOnce(JSON.stringify(projectSegments));

      await expect(queueService.addToQueue(projectId, queueData))
        .rejects.toThrow(ValidationError);
    });

    it('should validate repeat mode values', async () => {
      const projectStates = { [projectId]: mockQueueState };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projectStates));

      const invalidUpdates = {
        repeatMode: 'invalid-mode' as any
      };

      await expect(queueService.updateQueueState(projectId, invalidUpdates))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('Shuffle and Repeat Modes', () => {
    beforeEach(() => {
      const queueItem2 = { 
        ...mockQueueItem, 
        id: 'queue-item-2', 
        order: 2,
        segmentId: 'segment-2'
      };
      const projectQueues = { [projectId]: [mockQueueItem, queueItem2] };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projectQueues));
    });

    it('should handle repeat all mode', async () => {
      const projectStates = { 
        [projectId]: { 
          ...mockQueueState, 
          currentItemId: 'queue-item-2',
          currentPosition: 1,
          repeatMode: 'all'
        } 
      };
      
      mockLocalStorage.getItem
        .mockReturnValueOnce(JSON.stringify({ [projectId]: [mockQueueItem] }))
        .mockReturnValueOnce(JSON.stringify(projectStates));

      const result = await queueService.playNext(projectId);

      expect(result).toBeDefined(); // Should loop back to first item
    });

    it('should handle repeat one mode', async () => {
      const projectStates = { 
        [projectId]: { 
          ...mockQueueState, 
          currentItemId: 'queue-item-1',
          currentPosition: 0,
          repeatMode: 'one'
        } 
      };
      
      mockLocalStorage.getItem
        .mockReturnValueOnce(JSON.stringify({ [projectId]: [mockQueueItem] }))
        .mockReturnValueOnce(JSON.stringify(projectStates));

      const result = await queueService.playNext(projectId);

      expect(result?.id).toBe('queue-item-1'); // Should repeat same item
    });
  });
}); 