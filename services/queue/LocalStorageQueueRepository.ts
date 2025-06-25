import { 
  QueueRepository, 
  QueueItem, 
  AddQueueItemRequest,
  StorageService 
} from '../../types/services';
import { generateId } from '../../utils/common/id';

/**
 * LocalStorage를 사용한 Queue Repository 구현체
 * DIP(Dependency Inversion Principle)를 준수하여 StorageService에 의존
 */
export class LocalStorageQueueRepository implements QueueRepository {
  private readonly STORAGE_KEY = 'queue_items';
  
  constructor(private readonly storageService: StorageService) {}

  async findAll(): Promise<QueueItem[]> {
    const queueItems = await this.storageService.get<QueueItem[]>(this.STORAGE_KEY);
    return queueItems || [];
  }

  async findById(id: string): Promise<QueueItem | null> {
    const queueItems = await this.findAll();
    return queueItems.find(q => q.id === id) || null;
  }

  async create(data: AddQueueItemRequest): Promise<QueueItem> {
    const queueItems = await this.findAll();
    
    // 실제 구현에서는 segmentId로 Segment를 조회해야 하지만,
    // 여기서는 기본 구현만 제공
    const newQueueItem: QueueItem = {
      id: generateId(),
      segmentId: data.segmentId,
      segment: {} as any, // 실제로는 SegmentRepository에서 조회
      order: queueItems.length,
      metadata: {
        addedAt: new Date(),
        playCount: 0
      }
    };

    queueItems.push(newQueueItem);
    await this.storageService.set(this.STORAGE_KEY, queueItems);
    
    return newQueueItem;
  }

  async update(id: string, data: Partial<QueueItem>): Promise<QueueItem> {
    const queueItems = await this.findAll();
    const queueItemIndex = queueItems.findIndex(q => q.id === id);
    
    if (queueItemIndex === -1) {
      throw new Error(`Queue item with id ${id} not found`);
    }

    const existingQueueItem = queueItems[queueItemIndex];
    const updatedQueueItem: QueueItem = {
      ...existingQueueItem,
      ...data,
      metadata: {
        ...existingQueueItem.metadata,
        ...data.metadata
      }
    };

    queueItems[queueItemIndex] = updatedQueueItem;
    await this.storageService.set(this.STORAGE_KEY, queueItems);
    
    return updatedQueueItem;
  }

  async delete(id: string): Promise<void> {
    const queueItems = await this.findAll();
    const filteredQueueItems = queueItems.filter(q => q.id !== id);
    
    if (filteredQueueItems.length === queueItems.length) {
      throw new Error(`Queue item with id ${id} not found`);
    }

    await this.storageService.set(this.STORAGE_KEY, filteredQueueItems);
  }

  async exists(id: string): Promise<boolean> {
    const queueItem = await this.findById(id);
    return queueItem !== null;
  }

  async findByProjectId(projectId: string): Promise<QueueItem[]> {
    // 실제 구현에서는 projectId를 기반으로 필터링해야 하지만,
    // 현재 QueueItem 타입에 projectId가 없으므로 별도 저장 구조가 필요
    // 여기서는 기본 구현만 제공
    return this.findAll();
  }

  async reorder(projectId: string, itemIds: string[]): Promise<void> {
    const queueItems = await this.findByProjectId(projectId);
    
    // itemIds 순서대로 order 재설정
    const reorderedItems = itemIds.map((itemId, index) => {
      const item = queueItems.find(q => q.id === itemId);
      if (!item) {
        throw new Error(`Queue item with id ${itemId} not found`);
      }
      return {
        ...item,
        order: index
      };
    });

    // 전체 큐 아이템 목록에서 업데이트
    const allQueueItems = await this.findAll();
    const updatedQueueItems = allQueueItems.map(item => {
      const reorderedItem = reorderedItems.find(r => r.id === item.id);
      return reorderedItem || item;
    });

    await this.storageService.set(this.STORAGE_KEY, updatedQueueItems);
  }
} 