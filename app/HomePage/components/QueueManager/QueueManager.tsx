'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { QueueItem, QueueState, AddQueueItemRequest } from '@/types/services';
import { IdGenerator } from '@/utils/common/id-generator';
import { ErrorHandler } from '@/utils/common/error-handler';
import QueueList from './QueueList';
import { Button } from '@/components/ui/button';
import { Plus, Play, Pause, SkipForward, SkipBack, Shuffle, Repeat, Trash2 } from 'lucide-react';
import ErrorBoundaryWrapper from '@/components/error/ErrorBoundaryWrapper';
import ErrorFallback from '@/components/error/ErrorFallback';
import { logError, logInfo, trackEvent } from '@/utils/common/logger';

interface QueueManagerProps {
  projectId: string;
  queue?: QueueItem[];
  queueState?: QueueState;
  onQueueChange?: (queue: QueueItem[]) => void;
  onQueueStateChange?: (state: QueueState) => void;
}

const QueueManagerContent: React.FC<QueueManagerProps> = ({
  projectId,
  queue: initialQueue = [],
  queueState: initialQueueState,
  onQueueChange,
  onQueueStateChange
}) => {
  const [queue, setQueue] = useState<QueueItem[]>(initialQueue);
  const [queueState, setQueueState] = useState<QueueState>(initialQueueState || {
    currentItemId: null,
    currentPosition: 0,
    isPlaying: false,
    isLooping: false,
    isShuffled: false,
    repeatMode: 'none'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 큐 업데이트 헬퍼
  const updateQueue = useCallback((newQueue: QueueItem[]) => {
    setQueue(newQueue);
    onQueueChange?.(newQueue);
  }, [onQueueChange]);

  // 큐 상태 업데이트 헬퍼
  const updateQueueState = useCallback((newState: QueueState) => {
    setQueueState(newState);
    onQueueStateChange?.(newState);
  }, [onQueueStateChange]);

  // 큐에 아이템 추가
  const handleAddToQueue = useCallback(async (segmentId: string, segment: any, position?: number) => {
    setLoading(true);
    setError(null);

    try {
      // 낙관적 업데이트
      const newQueueItem: QueueItem = {
        id: IdGenerator.generate(),
        segmentId,
        segment,
        order: position !== undefined ? position : queue.length,
        metadata: {
          addedAt: new Date(),
          playCount: 0
        }
      };

      let newQueue: QueueItem[];
      if (position !== undefined) {
        // 지정된 위치에 삽입
        newQueue = [...queue];
        newQueue.splice(position, 0, newQueueItem);
        // 순서 재정렬
        newQueue = newQueue.map((item, index) => ({ ...item, order: index }));
      } else {
        // 맨 끝에 추가
        newQueue = [...queue, newQueueItem];
      }

      updateQueue(newQueue);

      // TODO: API 호출
      // await queueService.addToQueue(projectId, { segmentId, position });

    } catch (err) {
      const errorInfo = ErrorHandler.handle(err as Error, {
        projectId,
        segmentId,
        position
      });
      setError(errorInfo.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, queue, updateQueue]);

  // 큐에서 아이템 제거
  const handleRemoveFromQueue = useCallback(async (itemId: string) => {
    setLoading(true);
    setError(null);

    try {
      // 낙관적 업데이트
      const newQueue = queue.filter(item => item.id !== itemId)
        .map((item, index) => ({ ...item, order: index }));
      
      updateQueue(newQueue);

      // 현재 재생 중인 아이템이 삭제되면 상태 업데이트
      if (queueState.currentItemId === itemId) {
        updateQueueState({
          ...queueState,
          currentItemId: null,
          isPlaying: false
        });
      }

      // TODO: API 호출
      // await queueService.removeFromQueue(projectId, itemId);

    } catch (err) {
      const errorInfo = ErrorHandler.handle(err as Error, {
        projectId,
        itemId
      });
      setError(errorInfo.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, queue, queueState, updateQueue, updateQueueState]);

  // 큐 순서 변경
  const handleReorderQueue = useCallback(async (newOrder: string[]) => {
    setLoading(true);
    setError(null);

    try {
      // 낙관적 업데이트
      const orderedQueue = newOrder.map((itemId, index) => {
        const item = queue.find(q => q.id === itemId);
        return item ? { ...item, order: index } : null;
      }).filter(Boolean) as QueueItem[];

      updateQueue(orderedQueue);

      // TODO: API 호출
      // await queueService.reorderQueue(projectId, newOrder);

    } catch (err) {
      const errorInfo = ErrorHandler.handle(err as Error, {
        projectId,
        newOrder
      });
      setError(errorInfo.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, queue, updateQueue]);

  // 아이템 재생
  const handlePlayItem = useCallback(async (itemId: string) => {
    setLoading(true);
    setError(null);

    try {
      // 낙관적 업데이트
      const item = queue.find(q => q.id === itemId);
      if (item) {
        updateQueueState({
          ...queueState,
          currentItemId: itemId,
          isPlaying: true
        });

        // 재생 횟수 증가
        const updatedQueue = queue.map(q => 
          q.id === itemId 
            ? { 
                ...q, 
                metadata: { 
                  ...q.metadata, 
                  playCount: q.metadata.playCount + 1,
                  lastPlayedAt: new Date()
                }
              }
            : q
        );
        updateQueue(updatedQueue);
      }

      // TODO: API 호출
      // await queueService.playItem(projectId, itemId);

    } catch (err) {
      const errorInfo = ErrorHandler.handle(err as Error, {
        projectId,
        itemId
      });
      setError(errorInfo.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, queue, queueState, updateQueue, updateQueueState]);

  // 다음 아이템 재생
  const handlePlayNext = useCallback(async () => {
    if (queue.length === 0) return;

    const currentIndex = queue.findIndex(q => q.id === queueState.currentItemId);
    const nextIndex = currentIndex + 1;
    
    if (nextIndex < queue.length) {
      await handlePlayItem(queue[nextIndex].id);
    } else if (queueState.repeatMode === 'all') {
      await handlePlayItem(queue[0].id);
    }
  }, [queue, queueState, handlePlayItem]);

  // 이전 아이템 재생
  const handlePlayPrevious = useCallback(async () => {
    if (queue.length === 0) return;

    const currentIndex = queue.findIndex(q => q.id === queueState.currentItemId);
    const prevIndex = currentIndex - 1;
    
    if (prevIndex >= 0) {
      await handlePlayItem(queue[prevIndex].id);
    } else if (queueState.repeatMode === 'all') {
      await handlePlayItem(queue[queue.length - 1].id);
    }
  }, [queue, queueState, handlePlayItem]);

  // 재생/일시정지 토글
  const handleTogglePlay = useCallback(() => {
    updateQueueState({
      ...queueState,
      isPlaying: !queueState.isPlaying
    });
  }, [queueState, updateQueueState]);

  // 큐 지우기
  const handleClearQueue = useCallback(async () => {
    if (window.confirm('큐를 모두 지우시겠습니까?')) {
      setLoading(true);
      setError(null);

      try {
        updateQueue([]);
        updateQueueState({
          ...queueState,
          currentItemId: null,
          isPlaying: false
        });

        // TODO: API 호출
        // await queueService.clearQueue(projectId);

      } catch (err) {
        const errorInfo = ErrorHandler.handle(err as Error, {
          projectId
        });
        setError(errorInfo.message);
      } finally {
        setLoading(false);
      }
    }
  }, [projectId, queueState, updateQueue, updateQueueState]);

  // 에러 상태 자동 클리어
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">재생 큐</h2>
        <div className="text-sm text-gray-500">
          {queue.length}개 아이템
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 재생 컨트롤 */}
      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
        <Button
          onClick={handlePlayPrevious}
          disabled={loading || !queue.length || !queueState.currentItemId}
          size="sm"
          variant="outline"
        >
          <SkipBack className="w-4 h-4" />
        </Button>
        
        <Button
          onClick={handleTogglePlay}
          disabled={loading || !queue.length || !queueState.currentItemId}
          size="sm"
        >
          {queueState.isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </Button>
        
        <Button
          onClick={handlePlayNext}
          disabled={loading || !queue.length || !queueState.currentItemId}
          size="sm"
          variant="outline"
        >
          <SkipForward className="w-4 h-4" />
        </Button>

        <div className="flex-1" />
        
        <Button
          onClick={handleClearQueue}
          disabled={loading || !queue.length}
          size="sm"
          variant="outline"
          className="text-red-600 hover:text-red-700"
        >
          <Trash2 className="w-4 h-4" />
          전체 삭제
        </Button>
      </div>

      {/* 현재 재생 중인 아이템 표시 */}
      {queueState.currentItemId && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-blue-800">
              현재 재생 중: {queue.find(q => q.id === queueState.currentItemId)?.segment.title || 'Unknown'}
            </span>
          </div>
        </div>
      )}

      {/* 큐 리스트 */}
      <QueueList
        queue={queue}
        currentItemId={queueState.currentItemId}
        onPlayItem={handlePlayItem}
        onRemoveItem={handleRemoveFromQueue}
        onReorder={handleReorderQueue}
        loading={loading}
      />
    </div>
  );
};

// ErrorBoundary로 래핑된 QueueManager
const QueueManager: React.FC<QueueManagerProps> = (props) => {
  return (
    <ErrorBoundaryWrapper
      fallback={({ error, resetErrorBoundary }) => (
        <ErrorFallback
          error={error}
          resetErrorBoundary={resetErrorBoundary}
          showDetails={process.env.NODE_ENV === 'development'}
          severity="medium"
        />
      )}
      onError={(error, errorInfo) => {
        logError('QueueManager 컴포넌트 에러', {
          component: 'QueueManager',
          errorInfo: errorInfo.componentStack
        }, error);

        trackEvent('component_error', {
          component: 'QueueManager',
          errorType: error.constructor.name,
          errorMessage: error.message
        });
      }}
    >
      <QueueManagerContent {...props} />
    </ErrorBoundaryWrapper>
  );
};

export default QueueManager; 