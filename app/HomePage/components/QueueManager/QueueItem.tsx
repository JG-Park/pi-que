'use client';

import React from 'react';
import { QueueItem } from '@/types/services';
import { TimeFormatter } from '@/utils/time/time-formatter';
import { Button } from '@/components/ui/button';
import { Play, Trash2, ChevronUp, ChevronDown, Volume2 } from 'lucide-react';

interface QueueItemProps {
  item: QueueItem;
  isCurrentItem: boolean;
  onPlay: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  loading: boolean;
}

const QueueItemComponent: React.FC<QueueItemProps> = ({
  item,
  isCurrentItem,
  onPlay,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  loading
}) => {
  const handleRemove = () => {
    if (window.confirm('이 아이템을 큐에서 제거하시겠습니까?')) {
      onRemove();
    }
  };

  return (
    <div 
      className={`
        border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow 
        ${isCurrentItem ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
      `}
    >
      <div className="flex items-center justify-between">
        {/* 세그먼트 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isCurrentItem && (
              <Volume2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
            )}
            <h3 className={`font-medium truncate ${isCurrentItem ? 'text-blue-700' : 'text-gray-900'}`}>
              {item.segment.title}
            </h3>
          </div>
          
          {item.segment.description && (
            <p className="text-sm text-gray-600 mt-1 truncate">
              {item.segment.description}
            </p>
          )}
          
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <span>
              {TimeFormatter.secondsToTime(item.segment.startTime)} - {TimeFormatter.secondsToTime(item.segment.endTime)}
            </span>
            <span>
              {TimeFormatter.secondsToTime(item.segment.metadata.duration)}
            </span>
            {item.metadata.playCount > 0 && (
              <span>
                재생 {item.metadata.playCount}회
              </span>
            )}
          </div>
          
          {/* 태그 */}
          {item.segment.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {item.segment.tags.slice(0, 3).map((tag, index) => (
                <span 
                  key={index}
                  className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                >
                  {tag}
                </span>
              ))}
              {item.segment.tags.length > 3 && (
                <span className="text-xs text-gray-400">
                  +{item.segment.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 액션 버튼들 */}
        <div className="flex items-center gap-1 ml-4">
          {/* 순서 변경 버튼 */}
          <div className="flex flex-col">
            <Button
              variant="ghost"
              size="sm"
              onClick={onMoveUp}
              disabled={!canMoveUp || loading}
              className="h-6 px-1"
            >
              <ChevronUp className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onMoveDown}
              disabled={!canMoveDown || loading}
              className="h-6 px-1"
            >
              <ChevronDown className="w-3 h-3" />
            </Button>
          </div>

          {/* 재생 버튼 */}
          <Button
            variant={isCurrentItem ? "default" : "outline"}
            size="sm"
            onClick={onPlay}
            disabled={loading}
          >
            <Play className="w-4 h-4" />
          </Button>

          {/* 삭제 버튼 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={loading}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QueueItemComponent; 