'use client';

import React from 'react';
import { QueueItem } from '@/types/services';
import QueueItemComponent from './QueueItem';

interface QueueListProps {
  queue: QueueItem[];
  currentItemId: string | null;
  onPlayItem: (itemId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onReorder: (newOrder: string[]) => void;
  loading: boolean;
}

const QueueList: React.FC<QueueListProps> = ({
  queue,
  currentItemId,
  onPlayItem,
  onRemoveItem,
  onReorder,
  loading
}) => {
  // 순서대로 정렬
  const sortedQueue = [...queue].sort((a, b) => a.order - b.order);

  // 큐 아이템 위로 이동
  const handleMoveUp = (itemId: string) => {
    const currentIndex = sortedQueue.findIndex(q => q.id === itemId);
    if (currentIndex > 0) {
      const newOrder = [...sortedQueue];
      [newOrder[currentIndex], newOrder[currentIndex - 1]] = [newOrder[currentIndex - 1], newOrder[currentIndex]];
      onReorder(newOrder.map(q => q.id));
    }
  };

  // 큐 아이템 아래로 이동
  const handleMoveDown = (itemId: string) => {
    const currentIndex = sortedQueue.findIndex(q => q.id === itemId);
    if (currentIndex < sortedQueue.length - 1) {
      const newOrder = [...sortedQueue];
      [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]];
      onReorder(newOrder.map(q => q.id));
    }
  };

  if (queue.length === 0) {
    return (
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <p className="text-gray-500">큐가 비어있습니다.</p>
        <p className="text-sm text-gray-400 mt-2">세그먼트를 큐에 추가해 보세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sortedQueue.map((item, index) => (
        <QueueItemComponent
          key={item.id}
          item={item}
          isCurrentItem={item.id === currentItemId}
          onPlay={() => onPlayItem(item.id)}
          onRemove={() => onRemoveItem(item.id)}
          onMoveUp={() => handleMoveUp(item.id)}
          onMoveDown={() => handleMoveDown(item.id)}
          canMoveUp={index > 0}
          canMoveDown={index < sortedQueue.length - 1}
          loading={loading}
        />
      ))}
    </div>
  );
};

export default QueueList; 