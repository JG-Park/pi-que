'use client';

import React from 'react';
import { Segment } from '@/types/services';
import SegmentItem from './SegmentItem';

interface SegmentListProps {
  segments: Segment[];
  onEdit: (segment: Segment) => void;
  onDelete: (segmentId: string) => void;
  onReorder: (newOrder: string[]) => void;
  loading: boolean;
}

const SegmentList: React.FC<SegmentListProps> = ({
  segments,
  onEdit,
  onDelete,
  onReorder,
  loading
}) => {
  // 순서대로 정렬
  const sortedSegments = [...segments].sort((a, b) => a.metadata.order - b.metadata.order);

  // 세그먼트 위로 이동
  const handleMoveUp = (segmentId: string) => {
    const currentIndex = sortedSegments.findIndex(s => s.id === segmentId);
    if (currentIndex > 0) {
      const newOrder = [...sortedSegments];
      [newOrder[currentIndex], newOrder[currentIndex - 1]] = [newOrder[currentIndex - 1], newOrder[currentIndex]];
      onReorder(newOrder.map(s => s.id));
    }
  };

  // 세그먼트 아래로 이동
  const handleMoveDown = (segmentId: string) => {
    const currentIndex = sortedSegments.findIndex(s => s.id === segmentId);
    if (currentIndex < sortedSegments.length - 1) {
      const newOrder = [...sortedSegments];
      [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]];
      onReorder(newOrder.map(s => s.id));
    }
  };

  if (segments.length === 0) {
    return (
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <p className="text-gray-500">세그먼트가 없습니다.</p>
        <p className="text-sm text-gray-400 mt-2">새 세그먼트를 추가해 보세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedSegments.map((segment, index) => (
        <SegmentItem
          key={segment.id}
          segment={segment}
          onEdit={onEdit}
          onDelete={onDelete}
          onMoveUp={() => handleMoveUp(segment.id)}
          onMoveDown={() => handleMoveDown(segment.id)}
          canMoveUp={index > 0}
          canMoveDown={index < sortedSegments.length - 1}
          loading={loading}
        />
      ))}
    </div>
  );
};

export default SegmentList; 