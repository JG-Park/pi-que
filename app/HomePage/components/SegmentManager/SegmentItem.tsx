'use client';

import React from 'react';
import { Segment } from '@/types/services';
import { TimeFormatter } from '@/utils/time/time-formatter';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Play, ChevronUp, ChevronDown } from 'lucide-react';

interface SegmentItemProps {
  segment: Segment;
  onEdit: (segment: Segment) => void;
  onDelete: (segmentId: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  loading: boolean;
}

const SegmentItem: React.FC<SegmentItemProps> = ({
  segment,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  loading
}) => {
  const handleEdit = () => {
    onEdit(segment);
  };

  const handleDelete = () => {
    if (window.confirm('이 세그먼트를 삭제하시겠습니까?')) {
      onDelete(segment.id);
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 truncate">{segment.title}</h4>
          {segment.description && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{segment.description}</p>
          )}
          
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Play className="w-3 h-3" />
              {TimeFormatter.secondsToTime(segment.startTime)} - {TimeFormatter.secondsToTime(segment.endTime)}
            </span>
            <span>
              {TimeFormatter.secondsToTime(segment.metadata.duration)}
            </span>
          </div>

          {segment.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {segment.tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 ml-4">
          <div className="flex flex-col gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onMoveUp}
              disabled={loading || !canMoveUp}
              className="p-1 h-6 w-6"
              title="위로 이동"
            >
              <ChevronUp className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onMoveDown}
              disabled={loading || !canMoveDown}
              className="p-1 h-6 w-6"
              title="아래로 이동"
            >
              <ChevronDown className="w-3 h-3" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEdit}
              disabled={loading}
              className="flex items-center gap-1"
            >
              <Edit className="w-3 h-3" />
              편집
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={loading}
              className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-3 h-3" />
              삭제
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SegmentItem; 