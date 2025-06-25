import { 
  SegmentRepository, 
  Segment, 
  CreateSegmentRequest, 
  UpdateSegmentRequest,
  StorageService 
} from '../../types/services';
import { generateId } from '../../utils/common/id';

/**
 * LocalStorage를 사용한 Segment Repository 구현체
 * DIP(Dependency Inversion Principle)를 준수하여 StorageService에 의존
 */
export class LocalStorageSegmentRepository implements SegmentRepository {
  private readonly STORAGE_KEY = 'segments';
  
  constructor(private readonly storageService: StorageService) {}

  async findAll(): Promise<Segment[]> {
    const segments = await this.storageService.get<Segment[]>(this.STORAGE_KEY);
    return segments || [];
  }

  async findById(id: string): Promise<Segment | null> {
    const segments = await this.findAll();
    return segments.find(s => s.id === id) || null;
  }

  async create(data: CreateSegmentRequest): Promise<Segment> {
    const segments = await this.findAll();
    
    const newSegment: Segment = {
      id: generateId(),
      title: data.title,
      description: data.description,
      startTime: data.startTime,
      endTime: data.endTime,
      tags: data.tags || [],
      settings: {
        autoPlay: false,
        loop: false,
        volume: 100,
        playbackRate: 1.0,
        fadeIn: 0,
        fadeOut: 0,
        ...data.settings
      },
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        order: segments.length,
        duration: data.endTime - data.startTime
      }
    };

    segments.push(newSegment);
    await this.storageService.set(this.STORAGE_KEY, segments);
    
    return newSegment;
  }

  async update(id: string, data: UpdateSegmentRequest): Promise<Segment> {
    const segments = await this.findAll();
    const segmentIndex = segments.findIndex(s => s.id === id);
    
    if (segmentIndex === -1) {
      throw new Error(`Segment with id ${id} not found`);
    }

    const existingSegment = segments[segmentIndex];
    const updatedSegment: Segment = {
      ...existingSegment,
      ...data,
      settings: {
        ...existingSegment.settings,
        ...data.settings
      },
      metadata: {
        ...existingSegment.metadata,
        updatedAt: new Date(),
        duration: (data.endTime || existingSegment.endTime) - (data.startTime || existingSegment.startTime)
      }
    };

    segments[segmentIndex] = updatedSegment;
    await this.storageService.set(this.STORAGE_KEY, segments);
    
    return updatedSegment;
  }

  async delete(id: string): Promise<void> {
    const segments = await this.findAll();
    const filteredSegments = segments.filter(s => s.id !== id);
    
    if (filteredSegments.length === segments.length) {
      throw new Error(`Segment with id ${id} not found`);
    }

    await this.storageService.set(this.STORAGE_KEY, filteredSegments);
  }

  async exists(id: string): Promise<boolean> {
    const segment = await this.findById(id);
    return segment !== null;
  }

  async findByProjectId(projectId: string): Promise<Segment[]> {
    // 실제 구현에서는 projectId를 기반으로 필터링해야 하지만,
    // 현재 Segment 타입에 projectId가 없으므로 별도 저장 구조가 필요
    // 여기서는 기본 구현만 제공
    return this.findAll();
  }

  async findByTimeRange(projectId: string, startTime: number, endTime: number): Promise<Segment[]> {
    const segments = await this.findByProjectId(projectId);
    return segments.filter(s => 
      (s.startTime >= startTime && s.startTime <= endTime) ||
      (s.endTime >= startTime && s.endTime <= endTime) ||
      (s.startTime <= startTime && s.endTime >= endTime)
    );
  }
} 