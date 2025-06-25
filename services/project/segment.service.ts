import {
  SegmentService as ISegmentService,
  Segment,
  CreateSegmentRequest,
  UpdateSegmentRequest,
  PaginatedResponse,
  SearchOptions,
  ServiceError,
  ValidationError,
  NotFoundError
} from '../../types/services';
import { generateId } from '../../utils/common/generate-id';

export class SegmentService implements ISegmentService {
  readonly serviceName = 'SegmentService';
  readonly version = '1.0.0';
  
  private projectSegments: Map<string, Map<string, Segment>> = new Map();
  
  constructor() {
    this.loadSegments();
  }

  async isHealthy(): Promise<boolean> {
    try {
      localStorage.getItem('health-check');
      return true;
    } catch {
      return false;
    }
  }

  async createSegment(projectId: string, segment: CreateSegmentRequest): Promise<Segment> {
    this.validateProjectId(projectId);
    this.validateCreateRequest(segment);

    if (!this.projectSegments.has(projectId)) {
      this.projectSegments.set(projectId, new Map());
    }

    const segments = this.projectSegments.get(projectId)!;
    const nextOrder = segments.size;

    const newSegment: Segment = {
      id: generateId(),
      title: segment.title,
      description: segment.description || '',
      startTime: segment.startTime,
      endTime: segment.endTime,
      tags: segment.tags || [],
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        order: nextOrder,
        duration: segment.endTime - segment.startTime
      },
      settings: {
        autoPlay: false,
        loop: false,
        volume: 100,
        playbackRate: 1.0,
        fadeIn: 0,
        fadeOut: 0,
        ...segment.settings
      }
    };

    segments.set(newSegment.id, newSegment);
    await this.saveSegments();

    return newSegment;
  }

  async getSegment(projectId: string, segmentId: string): Promise<Segment> {
    this.validateProjectId(projectId);
    this.validateSegmentId(segmentId);

    const segments = this.projectSegments.get(projectId);
    if (!segments) {
      throw new NotFoundError('SegmentService', 'Project', projectId);
    }

    const segment = segments.get(segmentId);
    if (!segment) {
      throw new NotFoundError('SegmentService', 'Segment', segmentId);
    }

    return segment;
  }

  async getProjectSegments(projectId: string, options?: SearchOptions): Promise<PaginatedResponse<Segment>> {
    this.validateProjectId(projectId);

    const segments = this.projectSegments.get(projectId);
    let segmentList = segments ? Array.from(segments.values()) : [];

    // Apply search if provided
    if (options?.filters?.query) {
      const query = options.filters.query.toLowerCase();
      segmentList = segmentList.filter(s => 
        s.title.toLowerCase().includes(query) ||
        (s.description && s.description.toLowerCase().includes(query)) ||
        s.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply filtering by tags
    if (options?.filters?.tags && Array.isArray(options.filters.tags)) {
      segmentList = segmentList.filter(s =>
        options.filters!.tags.some((tag: string) => s.tags.includes(tag))
      );
    }

    // Apply sorting
    if (options?.sortBy) {
      segmentList.sort((a, b) => {
        let aValue: any, bValue: any;
        
        switch (options.sortBy) {
          case 'title':
            aValue = a.title;
            bValue = b.title;
            break;
          case 'startTime':
            aValue = a.startTime;
            bValue = b.startTime;
            break;
          case 'duration':
            aValue = a.metadata.duration;
            bValue = b.metadata.duration;
            break;
          case 'order':
          default:
            aValue = a.metadata.order;
            bValue = b.metadata.order;
        }

        if (aValue < bValue) return options.sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return options.sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      // Default sort by order
      segmentList.sort((a, b) => a.metadata.order - b.metadata.order);
    }

    // Apply pagination
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const totalItems = segmentList.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const offset = (page - 1) * pageSize;
    const items = segmentList.slice(offset, offset + pageSize);

    return {
      items,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1
      }
    };
  }

  async updateSegment(projectId: string, segmentId: string, updates: UpdateSegmentRequest): Promise<Segment> {
    const segment = await this.getSegment(projectId, segmentId);
    
    this.validateUpdateRequest(updates);

    // Update fields
    if (updates.title !== undefined) segment.title = updates.title;
    if (updates.description !== undefined) segment.description = updates.description;
    if (updates.startTime !== undefined) segment.startTime = updates.startTime;
    if (updates.endTime !== undefined) segment.endTime = updates.endTime;
    if (updates.tags !== undefined) segment.tags = updates.tags;
    if (updates.settings) {
      segment.settings = { ...segment.settings, ...updates.settings };
    }

    // Recalculate duration if times changed
    if (updates.startTime !== undefined || updates.endTime !== undefined) {
      segment.metadata.duration = segment.endTime - segment.startTime;
    }

    // Update metadata
    segment.metadata.updatedAt = new Date();

    await this.saveSegments();
    return segment;
  }

  async deleteSegment(projectId: string, segmentId: string): Promise<void> {
    const segment = await this.getSegment(projectId, segmentId); // Validates existence
    
    const segments = this.projectSegments.get(projectId)!;
    segments.delete(segmentId);

    // Reorder remaining segments
    await this.reorderSegmentsInternal(projectId, 
      Array.from(segments.values())
        .sort((a, b) => a.metadata.order - b.metadata.order)
        .map(s => s.id)
    );

    await this.saveSegments();
  }

  async reorderSegments(projectId: string, segmentIds: string[]): Promise<void> {
    this.validateProjectId(projectId);
    
    const segments = this.projectSegments.get(projectId);
    if (!segments) {
      throw new NotFoundError('SegmentService', 'Project', projectId);
    }

    // Validate all segment IDs exist
    for (const id of segmentIds) {
      if (!segments.has(id)) {
        throw new NotFoundError('SegmentService', 'Segment', id);
      }
    }

    await this.reorderSegmentsInternal(projectId, segmentIds);
    await this.saveSegments();
  }

  async duplicateSegment(projectId: string, segmentId: string): Promise<Segment> {
    const original = await this.getSegment(projectId, segmentId);
    
    const segments = this.projectSegments.get(projectId)!;
    const nextOrder = segments.size;

    const duplicated: Segment = {
      ...JSON.parse(JSON.stringify(original)), // Deep clone
      id: generateId(),
      title: `${original.title} (Copy)`,
      metadata: {
        ...original.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
        order: nextOrder
      }
    };

    segments.set(duplicated.id, duplicated);
    await this.saveSegments();

    return duplicated;
  }

  async mergeSegments(projectId: string, segmentIds: string[]): Promise<Segment> {
    if (segmentIds.length < 2) {
      throw new ValidationError('SegmentService', 'segmentIds', segmentIds, 'array with at least 2 items');
    }

    const segments = await Promise.all(
      segmentIds.map(id => this.getSegment(projectId, id))
    );

    // Sort by start time
    segments.sort((a, b) => a.startTime - b.startTime);

    const firstSegment = segments[0];
    const lastSegment = segments[segments.length - 1];

    // Create merged segment
    const mergedSegment: Segment = {
      id: generateId(),
      title: segments.map(s => s.title).join(' + '),
      description: segments.map(s => s.description).filter(Boolean).join(' | '),
      startTime: firstSegment.startTime,
      endTime: lastSegment.endTime,
      tags: [...new Set(segments.flatMap(s => s.tags))], // Unique tags
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        order: firstSegment.metadata.order,
        duration: lastSegment.endTime - firstSegment.startTime
      },
      settings: { ...firstSegment.settings }
    };

    // Remove original segments and add merged one
    const projectSegments = this.projectSegments.get(projectId)!;
    segmentIds.forEach(id => projectSegments.delete(id));
    projectSegments.set(mergedSegment.id, mergedSegment);

    // Reorder segments
    const remainingSegments = Array.from(projectSegments.values())
      .sort((a, b) => a.metadata.order - b.metadata.order);
    await this.reorderSegmentsInternal(projectId, remainingSegments.map(s => s.id));

    await this.saveSegments();
    return mergedSegment;
  }

  async splitSegment(projectId: string, segmentId: string, splitTime: number): Promise<Segment[]> {
    const original = await this.getSegment(projectId, segmentId);
    
    if (splitTime <= original.startTime || splitTime >= original.endTime) {
      throw new ValidationError('SegmentService', 'splitTime', splitTime, 
        `between ${original.startTime} and ${original.endTime}`);
    }

    const segments = this.projectSegments.get(projectId)!;

    // Create first part
    const firstPart: Segment = {
      ...JSON.parse(JSON.stringify(original)),
      id: generateId(),
      title: `${original.title} (Part 1)`,
      endTime: splitTime,
      metadata: {
        ...original.metadata,
        updatedAt: new Date(),
        duration: splitTime - original.startTime
      }
    };

    // Create second part
    const secondPart: Segment = {
      ...JSON.parse(JSON.stringify(original)),
      id: generateId(),
      title: `${original.title} (Part 2)`,
      startTime: splitTime,
      metadata: {
        ...original.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
        order: original.metadata.order + 1,
        duration: original.endTime - splitTime
      }
    };

    // Remove original and add new segments
    segments.delete(segmentId);
    segments.set(firstPart.id, firstPart);
    segments.set(secondPart.id, secondPart);

    // Reorder all segments to account for the new insertion
    const allSegments = Array.from(segments.values())
      .sort((a, b) => a.metadata.order - b.metadata.order);
    await this.reorderSegmentsInternal(projectId, allSegments.map(s => s.id));

    await this.saveSegments();
    return [firstPart, secondPart];
  }

  async searchSegments(projectId: string, query: string, options?: SearchOptions): Promise<PaginatedResponse<Segment>> {
    return this.getProjectSegments(projectId, {
      ...options,
      filters: { ...options?.filters, query }
    });
  }

  // Private helper methods
  private validateProjectId(projectId: string): void {
    if (!projectId || typeof projectId !== 'string') {
      throw new ValidationError('SegmentService', 'projectId', projectId, 'non-empty string');
    }
  }

  private validateSegmentId(segmentId: string): void {
    if (!segmentId || typeof segmentId !== 'string') {
      throw new ValidationError('SegmentService', 'segmentId', segmentId, 'non-empty string');
    }
  }

  private validateCreateRequest(request: CreateSegmentRequest): void {
    if (!request.title || request.title.trim().length === 0) {
      throw new ValidationError('SegmentService', 'title', request.title, 'non-empty string');
    }
    
    if (request.title.length > 200) {
      throw new ValidationError('SegmentService', 'title', request.title, 'string (max 200 chars)');
    }

    if (typeof request.startTime !== 'number' || request.startTime < 0) {
      throw new ValidationError('SegmentService', 'startTime', request.startTime, 'positive number');
    }

    if (typeof request.endTime !== 'number' || request.endTime <= request.startTime) {
      throw new ValidationError('SegmentService', 'endTime', request.endTime, 'number greater than startTime');
    }
  }

  private validateUpdateRequest(request: UpdateSegmentRequest): void {
    if (request.title !== undefined) {
      if (!request.title || request.title.trim().length === 0) {
        throw new ValidationError('SegmentService', 'title', request.title, 'non-empty string');
      }
      if (request.title.length > 200) {
        throw new ValidationError('SegmentService', 'title', request.title, 'string (max 200 chars)');
      }
    }

    if (request.startTime !== undefined && (typeof request.startTime !== 'number' || request.startTime < 0)) {
      throw new ValidationError('SegmentService', 'startTime', request.startTime, 'positive number');
    }

    if (request.endTime !== undefined && typeof request.endTime !== 'number') {
      throw new ValidationError('SegmentService', 'endTime', request.endTime, 'number');
    }
  }

  private async reorderSegmentsInternal(projectId: string, segmentIds: string[]): Promise<void> {
    const segments = this.projectSegments.get(projectId)!;
    
    segmentIds.forEach((id, index) => {
      const segment = segments.get(id);
      if (segment) {
        segment.metadata.order = index;
        segment.metadata.updatedAt = new Date();
      }
    });
  }

  private async loadSegments(): Promise<void> {
    try {
      const stored = localStorage.getItem('pi-que-segments');
      if (stored) {
        const data = JSON.parse(stored);
        Object.entries(data).forEach(([projectId, segments]: [string, any]) => {
          const segmentMap = new Map<string, Segment>();
          Object.entries(segments).forEach(([segmentId, segment]: [string, any]) => {
            // Convert date strings back to Date objects
            segment.metadata.createdAt = new Date(segment.metadata.createdAt);
            segment.metadata.updatedAt = new Date(segment.metadata.updatedAt);
            
            segmentMap.set(segmentId, segment as Segment);
          });
          this.projectSegments.set(projectId, segmentMap);
        });
      }
    } catch (error) {
      console.warn('Failed to load segments from localStorage:', error);
    }
  }

  private async saveSegments(): Promise<void> {
    try {
      const data: any = {};
      this.projectSegments.forEach((segments, projectId) => {
        data[projectId] = Object.fromEntries(segments);
      });
      localStorage.setItem('pi-que-segments', JSON.stringify(data));
    } catch (error) {
      throw new ServiceError('Failed to save segments', 'SegmentService', 'SAVE_ERROR', error as Error);
    }
  }
}

// Factory function
export const createSegmentService = (): SegmentService => {
  return new SegmentService();
};

// Singleton instance
let segmentServiceInstance: SegmentService | null = null;

export const getSegmentService = (): SegmentService => {
  if (!segmentServiceInstance) {
    segmentServiceInstance = createSegmentService();
  }
  return segmentServiceInstance;
}; 