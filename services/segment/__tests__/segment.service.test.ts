import { SegmentService } from '../segment.service';
import { createSegmentService, getSegmentService } from '../segment.service';
import { 
  Segment, 
  CreateSegmentRequest, 
  UpdateSegmentRequest, 
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

describe('SegmentService', () => {
  let segmentService: SegmentService;
  
  const mockSegment: Segment = {
    id: 'segment-1',
    title: 'Test Segment',
    description: 'A test segment',
    startTime: 10,
    endTime: 30,
    tags: ['test', 'demo'],
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

  const projectId = 'test-project-1';

  beforeEach(() => {
    segmentService = new SegmentService();
    jest.clearAllMocks();
    mockLocalStorage.length = 0;
  });

  describe('Constructor and Factory', () => {
    it('should create instance with default options', () => {
      expect(segmentService).toBeInstanceOf(SegmentService);
      expect(segmentService.isHealthy()).resolves.toBe(true);
    });

    it('should create instance via factory function', () => {
      const service = createSegmentService();
      expect(service).toBeInstanceOf(SegmentService);
    });

    it('should return singleton instance', () => {
      const service1 = getSegmentService();
      const service2 = getSegmentService();
      expect(service1).toBe(service2);
    });
  });

  describe('createSegment', () => {
    it('should create a new segment successfully', async () => {
      const segmentData: CreateSegmentRequest = {
        title: 'New Segment',
        description: 'A new segment',
        startTime: 0,
        endTime: 15,
        tags: ['new'],
        settings: {
          autoPlay: true,
          loop: false,
          volume: 80,
          playbackRate: 1.0,
          fadeIn: 1,
          fadeOut: 1
        }
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({}));

      const result = await segmentService.createSegment(projectId, segmentData);

      expect(result).toMatchObject({
        title: segmentData.title,
        description: segmentData.description,
        startTime: segmentData.startTime,
        endTime: segmentData.endTime,
        tags: segmentData.tags
      });
      expect(result.id).toBeDefined();
      expect(result.metadata.createdAt).toBeInstanceOf(Date);
      expect(result.metadata.duration).toBe(15);
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should throw ValidationError for invalid segment data', async () => {
      const invalidData: CreateSegmentRequest = {
        title: '', // Empty title should be invalid
        startTime: 10,
        endTime: 5 // End time before start time
      };

      await expect(segmentService.createSegment(projectId, invalidData))
        .rejects.toThrow(ValidationError);
    });

    it('should handle localStorage errors', async () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const segmentData: CreateSegmentRequest = {
        title: 'Test Segment',
        startTime: 0,
        endTime: 10
      };

      await expect(segmentService.createSegment(projectId, segmentData))
        .rejects.toThrow(ServiceError);
    });
  });

  describe('getSegment', () => {
    it('should retrieve existing segment', async () => {
      const projectSegments = { [projectId]: [mockSegment] };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projectSegments));

      const result = await segmentService.getSegment(projectId, 'segment-1');

      expect(result.id).toBe(mockSegment.id);
      expect(result.title).toBe(mockSegment.title);
    });

    it('should throw NotFoundError for non-existent segment', async () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({}));

      await expect(segmentService.getSegment(projectId, 'non-existent'))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError for non-existent project', async () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({}));

      await expect(segmentService.getSegment('non-existent-project', 'segment-1'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('updateSegment', () => {
    beforeEach(() => {
      const projectSegments = { [projectId]: [mockSegment] };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projectSegments));
    });

    it('should update existing segment', async () => {
      const updates: UpdateSegmentRequest = {
        title: 'Updated Segment Title',
        description: 'Updated description',
        endTime: 25
      };

      const result = await segmentService.updateSegment(projectId, 'segment-1', updates);

      expect(result.title).toBe(updates.title);
      expect(result.description).toBe(updates.description);
      expect(result.endTime).toBe(updates.endTime);
      expect(result.metadata.duration).toBe(15); // 25 - 10
      expect(result.metadata.updatedAt).toBeInstanceOf(Date);
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should throw NotFoundError for non-existent segment', async () => {
      const updates: UpdateSegmentRequest = { title: 'Updated Title' };

      await expect(segmentService.updateSegment(projectId, 'non-existent', updates))
        .rejects.toThrow(NotFoundError);
    });

    it('should validate update data', async () => {
      const invalidUpdates: UpdateSegmentRequest = { 
        startTime: 20,
        endTime: 15 // End time before start time
      };

      await expect(segmentService.updateSegment(projectId, 'segment-1', invalidUpdates))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('deleteSegment', () => {
    beforeEach(() => {
      const projectSegments = { [projectId]: [mockSegment] };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projectSegments));
    });

    it('should delete existing segment', async () => {
      await segmentService.deleteSegment(projectId, 'segment-1');

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should throw NotFoundError for non-existent segment', async () => {
      await expect(segmentService.deleteSegment(projectId, 'non-existent'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('getProjectSegments', () => {
    it('should return all segments for a project with pagination', async () => {
      const segments = [mockSegment];
      const projectSegments = { [projectId]: segments };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projectSegments));

      const result = await segmentService.getProjectSegments(projectId);

      expect(result.items).toEqual(segments);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.totalItems).toBe(1);
    });

    it('should return empty array when no segments exist', async () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({}));

      const result = await segmentService.getProjectSegments(projectId);

      expect(result.items).toEqual([]);
      expect(result.pagination.totalItems).toBe(0);
    });

    it('should handle search and pagination', async () => {
      const segments = [mockSegment];
      const projectSegments = { [projectId]: segments };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projectSegments));

      const result = await segmentService.getProjectSegments(projectId, {
        filters: { query: 'Test' },
        page: 1,
        pageSize: 10
      });

      expect(result.items).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
    });

    it('should handle sorting', async () => {
      const segments = [mockSegment];
      const projectSegments = { [projectId]: segments };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projectSegments));

      const result = await segmentService.getProjectSegments(projectId, {
        sortBy: 'title',
        sortOrder: 'desc'
      });

      expect(result.items).toHaveLength(1);
    });
  });

  describe('reorderSegments', () => {
    const segment2 = { ...mockSegment, id: 'segment-2', metadata: { ...mockSegment.metadata, order: 2 } };
    
    beforeEach(() => {
      const projectSegments = { [projectId]: [mockSegment, segment2] };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projectSegments));
    });

    it('should reorder segments successfully', async () => {
      await segmentService.reorderSegments(projectId, ['segment-2', 'segment-1']);

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should throw ValidationError for invalid segment IDs', async () => {
      await expect(segmentService.reorderSegments(projectId, ['non-existent']))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('duplicateSegment', () => {
    beforeEach(() => {
      const projectSegments = { [projectId]: [mockSegment] };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projectSegments));
    });

    it('should duplicate existing segment', async () => {
      const result = await segmentService.duplicateSegment(projectId, 'segment-1');

      expect(result.title).toBe(`${mockSegment.title} (Copy)`);
      expect(result.id).not.toBe(mockSegment.id);
      expect(result.startTime).toBe(mockSegment.startTime);
      expect(result.endTime).toBe(mockSegment.endTime);
    });

    it('should throw NotFoundError for non-existent segment', async () => {
      await expect(segmentService.duplicateSegment(projectId, 'non-existent'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('mergeSegments', () => {
    const segment2 = { 
      ...mockSegment, 
      id: 'segment-2', 
      title: 'Second Segment',
      startTime: 30,
      endTime: 50,
      metadata: { ...mockSegment.metadata, order: 2, duration: 20 }
    };
    
    beforeEach(() => {
      const projectSegments = { [projectId]: [mockSegment, segment2] };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projectSegments));
    });

    it('should merge segments successfully', async () => {
      const result = await segmentService.mergeSegments(projectId, ['segment-1', 'segment-2']);

      expect(result.title).toContain('Merged');
      expect(result.startTime).toBe(10); // Start of first segment
      expect(result.endTime).toBe(50); // End of last segment
      expect(result.metadata.duration).toBe(40);
    });

    it('should throw ValidationError for insufficient segments', async () => {
      await expect(segmentService.mergeSegments(projectId, ['segment-1']))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent segments', async () => {
      await expect(segmentService.mergeSegments(projectId, ['segment-1', 'non-existent']))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('splitSegment', () => {
    beforeEach(() => {
      const projectSegments = { [projectId]: [mockSegment] };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projectSegments));
    });

    it('should split segment successfully', async () => {
      const result = await segmentService.splitSegment(projectId, 'segment-1', 20);

      expect(result).toHaveLength(2);
      expect(result[0].endTime).toBe(20);
      expect(result[1].startTime).toBe(20);
      expect(result[0].title).toContain('Part 1');
      expect(result[1].title).toContain('Part 2');
    });

    it('should throw ValidationError for invalid split time', async () => {
      await expect(segmentService.splitSegment(projectId, 'segment-1', 5))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent segment', async () => {
      await expect(segmentService.splitSegment(projectId, 'non-existent', 15))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('searchSegments', () => {
    beforeEach(() => {
      const segments = [
        mockSegment,
        { ...mockSegment, id: 'segment-2', title: 'Another Segment', tags: ['other'] }
      ];
      const projectSegments = { [projectId]: segments };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projectSegments));
    });

    it('should search segments by title', async () => {
      const result = await segmentService.searchSegments(projectId, 'Test');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('Test Segment');
    });

    it('should search segments by tags', async () => {
      const result = await segmentService.searchSegments(projectId, 'demo');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].tags).toContain('demo');
    });

    it('should handle empty search results', async () => {
      const result = await segmentService.searchSegments(projectId, 'nonexistent');

      expect(result.items).toHaveLength(0);
      expect(result.pagination.totalItems).toBe(0);
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const isHealthy = await segmentService.isHealthy();
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

      const segmentData: CreateSegmentRequest = {
        title: 'Test Segment',
        startTime: 0,
        endTime: 10
      };

      await expect(segmentService.createSegment(projectId, segmentData))
        .rejects.toThrow(ServiceError);
    });

    it('should handle localStorage access denied', async () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Access denied');
      });

      await expect(segmentService.getProjectSegments(projectId))
        .rejects.toThrow(ServiceError);
    });
  });

  describe('Validation', () => {
    it('should validate segment title length', async () => {
      const longTitle = 'a'.repeat(256); // Assuming max length is 255
      const segmentData: CreateSegmentRequest = {
        title: longTitle,
        startTime: 0,
        endTime: 10
      };

      await expect(segmentService.createSegment(projectId, segmentData))
        .rejects.toThrow(ValidationError);
    });

    it('should validate time ranges', async () => {
      const segmentData: CreateSegmentRequest = {
        title: 'Test Segment',
        startTime: -5, // Negative start time
        endTime: 10
      };

      await expect(segmentService.createSegment(projectId, segmentData))
        .rejects.toThrow(ValidationError);
    });

    it('should validate playback settings', async () => {
      const segmentData: CreateSegmentRequest = {
        title: 'Test Segment',
        startTime: 0,
        endTime: 10,
        settings: {
          autoPlay: true,
          loop: false,
          volume: 150, // Invalid volume > 100
          playbackRate: 1.0,
          fadeIn: 0,
          fadeOut: 0
        }
      };

      await expect(segmentService.createSegment(projectId, segmentData))
        .rejects.toThrow(ValidationError);
    });
  });
}); 