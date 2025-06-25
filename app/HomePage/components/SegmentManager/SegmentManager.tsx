'use client';

import React, { useState, useCallback } from 'react';
import { Segment, CreateSegmentRequest, UpdateSegmentRequest, SegmentSettings } from '@/types/services';
import { IdGenerator } from '@/utils/common/id-generator';
import { ErrorHandler } from '@/utils/common/error-handler';
import SegmentList from './SegmentList';
import SegmentForm from './SegmentForm';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface SegmentManagerProps {
  projectId: string;
  segments?: Segment[];
  onSegmentsChange?: (segments: Segment[]) => void;
}

const SegmentManager: React.FC<SegmentManagerProps> = ({
  projectId,
  segments: initialSegments = [],
  onSegmentsChange
}) => {
  const [segments, setSegments] = useState<Segment[]>(initialSegments);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 세그먼트 목록 업데이트 헬퍼
  const updateSegments = useCallback((newSegments: Segment[]) => {
    setSegments(newSegments);
    onSegmentsChange?.(newSegments);
  }, [onSegmentsChange]);

  // 새 세그먼트 생성
  const handleCreateSegment = useCallback(async (data: CreateSegmentRequest): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      // 낙관적 업데이트
      const newSegment: Segment = {
        id: IdGenerator.generateSegmentId(),
        title: data.title,
        description: data.description,
        startTime: data.startTime,
        endTime: data.endTime,
        tags: data.tags || [],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          order: segments.length,
          duration: data.endTime - data.startTime
        },
        settings: {
          autoPlay: false,
          loop: false,
          volume: 100,
          playbackRate: 1,
          fadeIn: 0,
          fadeOut: 0,
          ...data.settings
        } as SegmentSettings
      };

      const updatedSegments = [...segments, newSegment];
      updateSegments(updatedSegments);
      setIsFormOpen(false);

      // TODO: API 호출로 서버에 저장
      // await segmentService.createSegment(projectId, data);

    } catch (error) {
      ErrorHandler.handle(error as Error, { context: 'CreateSegment', projectId });
      setError('세그먼트 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [segments, updateSegments, projectId]);

  // 세그먼트 업데이트
  const handleUpdateSegment = useCallback(async (segmentId: string, data: UpdateSegmentRequest): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      // 낙관적 업데이트
      const updatedSegments = segments.map(segment => {
        if (segment.id === segmentId) {
          return {
            ...segment,
            ...data,
            metadata: {
              ...segment.metadata,
              updatedAt: new Date(),
              duration: (data.endTime ?? segment.endTime) - (data.startTime ?? segment.startTime)
            },
            settings: data.settings ? { ...segment.settings, ...data.settings } : segment.settings
          };
        }
        return segment;
      });

      updateSegments(updatedSegments);
      setEditingSegment(null);
      setIsFormOpen(false);

      // TODO: API 호출로 서버에 저장
      // await segmentService.updateSegment(projectId, segmentId, data);

    } catch (error) {
      ErrorHandler.handle(error as Error, { context: 'UpdateSegment', projectId, segmentId });
      setError('세그먼트 업데이트에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [segments, updateSegments, projectId]);

  // 세그먼트 삭제
  const handleDeleteSegment = useCallback(async (segmentId: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      // 낙관적 업데이트
      const updatedSegments = segments.filter(segment => segment.id !== segmentId);
      updateSegments(updatedSegments);

      // TODO: API 호출로 서버에서 삭제
      // await segmentService.deleteSegment(projectId, segmentId);

    } catch (error) {
      ErrorHandler.handle(error as Error, { context: 'DeleteSegment', projectId, segmentId });
      setError('세그먼트 삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [segments, updateSegments, projectId]);

  // 세그먼트 순서 변경
  const handleReorderSegments = useCallback(async (newOrder: string[]): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      // 낙관적 업데이트
      const reorderedSegments = newOrder.map((segmentId, index) => {
        const segment = segments.find(s => s.id === segmentId);
        if (!segment) return null;
        
        return {
          ...segment,
          metadata: {
            ...segment.metadata,
            order: index,
            updatedAt: new Date()
          }
        };
      }).filter(Boolean) as Segment[];

      updateSegments(reorderedSegments);

      // TODO: API 호출로 서버에 저장
      // await segmentService.reorderSegments(projectId, newOrder);

    } catch (error) {
      ErrorHandler.handle(error as Error, { context: 'ReorderSegments', projectId });
      setError('세그먼트 순서 변경에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [segments, updateSegments, projectId]);

  // 편집 모드 진입
  const handleEditSegment = useCallback((segment: Segment) => {
    setEditingSegment(segment);
    setIsFormOpen(true);
  }, []);

  // 폼 닫기
  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false);
    setEditingSegment(null);
  }, []);

  // 새 세그먼트 추가 버튼 클릭
  const handleAddSegment = useCallback(() => {
    setEditingSegment(null);
    setIsFormOpen(true);
  }, []);

  return (
    <div className="segment-manager space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">세그먼트 관리</h2>
        <Button 
          onClick={handleAddSegment}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          세그먼트 추가
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 세그먼트 목록 */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">세그먼트 목록</h3>
          <SegmentList
            segments={segments}
            onEdit={handleEditSegment}
            onDelete={handleDeleteSegment}
            onReorder={handleReorderSegments}
            loading={loading}
          />
        </div>

        {/* 세그먼트 폼 */}
        {isFormOpen && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">
              {editingSegment ? '세그먼트 편집' : '새 세그먼트'}
            </h3>
            <SegmentForm
              segment={editingSegment}
              onSubmit={editingSegment 
                ? (data: UpdateSegmentRequest) => handleUpdateSegment(editingSegment.id, data)
                : handleCreateSegment
              }
              onCancel={handleCloseForm}
              loading={loading}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default SegmentManager; 