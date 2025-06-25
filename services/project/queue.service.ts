import {
  QueueService as IQueueService,
  QueueItem,
  AddQueueItemRequest,
  QueueState,
  Segment,
  ServiceError,
  ValidationError,
  NotFoundError
} from '../../types/services';
import { generateId } from '../../utils/common/generate-id';

export class QueueService implements IQueueService {
  readonly serviceName = 'QueueService';
  readonly version = '1.0.0';
  
  private projectQueues: Map<string, QueueItem[]> = new Map();
  private queueStates: Map<string, QueueState> = new Map();
  
  constructor() {
    this.loadQueues();
  }

  async isHealthy(): Promise<boolean> {
    try {
      localStorage.getItem('health-check');
      return true;
    } catch {
      return false;
    }
  }

  async addToQueue(projectId: string, item: AddQueueItemRequest): Promise<QueueItem> {
    this.validateProjectId(projectId);
    this.validateAddQueueItemRequest(item);

    if (!this.projectQueues.has(projectId)) {
      this.projectQueues.set(projectId, []);
    }

    const queue = this.projectQueues.get(projectId)!;
    const position = item.position !== undefined ? item.position : queue.length;

    // Validate position
    if (position < 0 || position > queue.length) {
      throw new ValidationError('QueueService', 'position', position, `between 0 and ${queue.length}`);
    }

    // Create queue item (we'll assume we have access to the segment)
    const queueItem: QueueItem = {
      id: generateId(),
      segmentId: item.segmentId,
      segment: {} as Segment, // This would be fetched from SegmentService in real implementation
      order: position,
      metadata: {
        addedAt: new Date(),
        playCount: 0
      }
    };

    // Insert at specified position
    queue.splice(position, 0, queueItem);

    // Update order for all items after the insertion point
    for (let i = position + 1; i < queue.length; i++) {
      queue[i].order = i;
    }

    await this.saveQueues();
    return queueItem;
  }

  async removeFromQueue(projectId: string, itemId: string): Promise<void> {
    this.validateProjectId(projectId);
    this.validateItemId(itemId);

    const queue = this.projectQueues.get(projectId);
    if (!queue) {
      throw new NotFoundError('QueueService', 'Project Queue', projectId);
    }

    const index = queue.findIndex(item => item.id === itemId);
    if (index === -1) {
      throw new NotFoundError('QueueService', 'Queue Item', itemId);
    }

    queue.splice(index, 1);

    // Update order for remaining items
    queue.forEach((item, i) => {
      item.order = i;
    });

    await this.saveQueues();
  }

  async clearQueue(projectId: string): Promise<void> {
    this.validateProjectId(projectId);

    this.projectQueues.set(projectId, []);
    
    // Reset queue state
    const state = this.queueStates.get(projectId);
    if (state) {
      state.currentItemId = null;
      state.currentPosition = 0;
      state.isPlaying = false;
    }

    await this.saveQueues();
  }

  async getQueue(projectId: string): Promise<QueueItem[]> {
    this.validateProjectId(projectId);

    const queue = this.projectQueues.get(projectId);
    return queue ? [...queue].sort((a, b) => a.order - b.order) : [];
  }

  async reorderQueue(projectId: string, itemIds: string[]): Promise<void> {
    this.validateProjectId(projectId);

    const queue = this.projectQueues.get(projectId);
    if (!queue) {
      throw new NotFoundError('QueueService', 'Project Queue', projectId);
    }

    // Validate all item IDs exist
    for (const id of itemIds) {
      if (!queue.find(item => item.id === id)) {
        throw new NotFoundError('QueueService', 'Queue Item', id);
      }
    }

    // Reorder queue items
    const reorderedQueue: QueueItem[] = [];
    itemIds.forEach((id, index) => {
      const item = queue.find(item => item.id === id)!;
      item.order = index;
      reorderedQueue.push(item);
    });

    this.projectQueues.set(projectId, reorderedQueue);
    await this.saveQueues();
  }

  async moveQueueItem(projectId: string, itemId: string, newPosition: number): Promise<void> {
    this.validateProjectId(projectId);
    this.validateItemId(itemId);

    const queue = this.projectQueues.get(projectId);
    if (!queue) {
      throw new NotFoundError('QueueService', 'Project Queue', projectId);
    }

    const itemIndex = queue.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      throw new NotFoundError('QueueService', 'Queue Item', itemId);
    }

    if (newPosition < 0 || newPosition >= queue.length) {
      throw new ValidationError('QueueService', 'newPosition', newPosition, `between 0 and ${queue.length - 1}`);
    }

    // Remove item from current position
    const [item] = queue.splice(itemIndex, 1);
    
    // Insert at new position
    queue.splice(newPosition, 0, item);

    // Update order for all items
    queue.forEach((item, index) => {
      item.order = index;
    });

    await this.saveQueues();
  }

  async playNext(projectId: string): Promise<QueueItem | null> {
    const state = await this.getQueueState(projectId);
    const queue = await this.getQueue(projectId);

    if (queue.length === 0) {
      return null;
    }

    let nextIndex: number;

    if (state.isShuffled) {
      // Random next item
      nextIndex = Math.floor(Math.random() * queue.length);
    } else if (state.currentItemId) {
      const currentIndex = queue.findIndex(item => item.id === state.currentItemId);
      nextIndex = (currentIndex + 1) % queue.length;
      
      // Handle repeat modes
      if (nextIndex === 0 && state.repeatMode === 'none') {
        return null; // End of queue
      }
    } else {
      nextIndex = 0; // Start from beginning
    }

    const nextItem = queue[nextIndex];
    
    // Update state
    state.currentItemId = nextItem.id;
    state.currentPosition = nextIndex;
    state.isPlaying = true;

    // Update play count
    nextItem.metadata.playCount++;
    nextItem.metadata.lastPlayedAt = new Date();

    await this.updateQueueState(projectId, state);
    await this.saveQueues();

    return nextItem;
  }

  async playPrevious(projectId: string): Promise<QueueItem | null> {
    const state = await this.getQueueState(projectId);
    const queue = await this.getQueue(projectId);

    if (queue.length === 0 || !state.currentItemId) {
      return null;
    }

    const currentIndex = queue.findIndex(item => item.id === state.currentItemId);
    let previousIndex: number;

    if (state.isShuffled) {
      // Random previous item
      previousIndex = Math.floor(Math.random() * queue.length);
    } else {
      previousIndex = currentIndex > 0 ? currentIndex - 1 : queue.length - 1;
      
      // Handle repeat modes
      if (currentIndex === 0 && state.repeatMode === 'none') {
        return null; // Beginning of queue
      }
    }

    const previousItem = queue[previousIndex];
    
    // Update state
    state.currentItemId = previousItem.id;
    state.currentPosition = previousIndex;
    state.isPlaying = true;

    // Update play count
    previousItem.metadata.playCount++;
    previousItem.metadata.lastPlayedAt = new Date();

    await this.updateQueueState(projectId, state);
    await this.saveQueues();

    return previousItem;
  }

  async playItem(projectId: string, itemId: string): Promise<void> {
    this.validateProjectId(projectId);
    this.validateItemId(itemId);

    const queue = await this.getQueue(projectId);
    const itemIndex = queue.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      throw new NotFoundError('QueueService', 'Queue Item', itemId);
    }

    const item = queue[itemIndex];
    const state = await this.getQueueState(projectId);

    // Update state
    state.currentItemId = itemId;
    state.currentPosition = itemIndex;
    state.isPlaying = true;

    // Update play count
    item.metadata.playCount++;
    item.metadata.lastPlayedAt = new Date();

    await this.updateQueueState(projectId, state);
    await this.saveQueues();
  }

  async getQueueState(projectId: string): Promise<QueueState> {
    this.validateProjectId(projectId);

    let state = this.queueStates.get(projectId);
    if (!state) {
      state = {
        currentItemId: null,
        currentPosition: 0,
        isPlaying: false,
        isLooping: false,
        isShuffled: false,
        repeatMode: 'none'
      };
      this.queueStates.set(projectId, state);
    }

    return { ...state }; // Return a copy
  }

  async updateQueueState(projectId: string, state: Partial<QueueState>): Promise<QueueState> {
    this.validateProjectId(projectId);

    const currentState = await this.getQueueState(projectId);
    const updatedState = { ...currentState, ...state };

    this.queueStates.set(projectId, updatedState);
    await this.saveQueues();

    return updatedState;
  }

  // Private helper methods
  private validateProjectId(projectId: string): void {
    if (!projectId || typeof projectId !== 'string') {
      throw new ValidationError('QueueService', 'projectId', projectId, 'non-empty string');
    }
  }

  private validateItemId(itemId: string): void {
    if (!itemId || typeof itemId !== 'string') {
      throw new ValidationError('QueueService', 'itemId', itemId, 'non-empty string');
    }
  }

  private validateAddQueueItemRequest(request: AddQueueItemRequest): void {
    if (!request.segmentId || typeof request.segmentId !== 'string') {
      throw new ValidationError('QueueService', 'segmentId', request.segmentId, 'non-empty string');
    }

    if (request.position !== undefined && (typeof request.position !== 'number' || request.position < 0)) {
      throw new ValidationError('QueueService', 'position', request.position, 'positive number');
    }
  }

  private async loadQueues(): Promise<void> {
    try {
      // Load queues
      const queueData = localStorage.getItem('pi-que-queues');
      if (queueData) {
        const queues = JSON.parse(queueData);
        Object.entries(queues).forEach(([projectId, queue]) => {
          const queueArray = queue as any[];
          const queueItems = queue.map(item => ({
            ...item,
            metadata: {
              ...item.metadata,
              addedAt: new Date(item.metadata.addedAt),
              lastPlayedAt: item.metadata.lastPlayedAt ? new Date(item.metadata.lastPlayedAt) : undefined
            }
          }));
          this.projectQueues.set(projectId, queueItems);
        });
      }

      // Load queue states
      const stateData = localStorage.getItem('pi-que-queue-states');
      if (stateData) {
        const states = JSON.parse(stateData);
        Object.entries(states).forEach(([projectId, state]) => {
          this.queueStates.set(projectId, state as QueueState);
        });
      }
    } catch (error) {
      console.warn('Failed to load queues from localStorage:', error);
    }
  }

  private async saveQueues(): Promise<void> {
    try {
      // Save queues
      const queueData = Object.fromEntries(this.projectQueues);
      localStorage.setItem('pi-que-queues', JSON.stringify(queueData));

      // Save queue states
      const stateData = Object.fromEntries(this.queueStates);
      localStorage.setItem('pi-que-queue-states', JSON.stringify(stateData));
    } catch (error) {
      throw new ServiceError('Failed to save queues', 'QueueService', 'SAVE_ERROR', error as Error);
    }
  }
}

// Factory function
export const createQueueService = (): QueueService => {
  return new QueueService();
};

// Singleton instance
let queueServiceInstance: QueueService | null = null;

export const getQueueService = (): QueueService => {
  if (!queueServiceInstance) {
    queueServiceInstance = createQueueService();
  }
  return queueServiceInstance;
}; 