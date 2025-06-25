'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Segment, CreateSegmentRequest, UpdateSegmentRequest } from '@/types/services';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TimeFormatter } from '@/utils/time/time-formatter';
import { usePlayer } from '@/contexts/player-context';
import { ChevronUp, ChevronDown } from 'lucide-react';

// Validation schema
const segmentSchema = z.object({
  title: z.string()
    .min(1, '제목을 입력해주세요.')
    .max(100, '제목은 100자 이하로 입력해주세요.'),
  description: z.string()
    .max(500, '설명은 500자 이하로 입력해주세요.')
    .optional(),
  startTime: z.string()
    .min(1, '시작 시간을 입력해주세요.')
    .refine((val) => {
      try {
        TimeFormatter.timeToSeconds(val);
        return true;
      } catch {
        return false;
      }
    }, '올바른 시간 형식을 입력해주세요. (예: 1:30, 0:05:30)'),
  endTime: z.string()
    .min(1, '종료 시간을 입력해주세요.')
    .refine((val) => {
      try {
        TimeFormatter.timeToSeconds(val);
        return true;
      } catch {
        return false;
      }
    }, '올바른 시간 형식을 입력해주세요. (예: 2:45, 0:10:15)'),
  tags: z.string()
    .optional()
}).refine((data) => {
  try {
    const startSeconds = TimeFormatter.timeToSeconds(data.startTime);
    const endSeconds = TimeFormatter.timeToSeconds(data.endTime);
    return startSeconds < endSeconds;
  } catch {
    return false;
  }
}, {
  message: '종료 시간은 시작 시간보다 늦어야 합니다.',
  path: ['endTime']
});

type SegmentFormData = z.infer<typeof segmentSchema>;

interface SegmentFormProps {
  segment?: Segment | null;
  onSubmit: (data: CreateSegmentRequest | UpdateSegmentRequest) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  // 현재 플레이어 시간 (기본값 설정용)
  currentTime?: number;
}

const SegmentForm: React.FC<SegmentFormProps> = ({
  segment,
  onSubmit,
  onCancel,
  loading,
  currentTime = 0
}) => {
  const { state } = usePlayer();
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue
  } = useForm<SegmentFormData>({
    resolver: zodResolver(segmentSchema),
    defaultValues: {
      title: segment?.title || (state.currentVideo?.title ? `${state.currentVideo.title} 구간` : ''),
      description: segment?.description || '',
      startTime: segment ? TimeFormatter.secondsToTime(segment.startTime) : TimeFormatter.secondsToTime(currentTime || state.currentTime),
      endTime: segment ? TimeFormatter.secondsToTime(segment.endTime) : TimeFormatter.secondsToTime((currentTime || state.currentTime) + 30),
      tags: segment?.tags.join(', ') || ''
    }
  });

  // 현재 비디오나 시간이 변경될 때 폼 업데이트
  useEffect(() => {
    if (!segment && state.currentVideo) {
      // 비디오가 변경되면 폼을 완전히 리셋하고 새로운 값들로 설정
      const newValues = {
        title: `${state.currentVideo.title} 구간`,
        description: '',
        startTime: TimeFormatter.secondsToTime(currentTime || state.currentTime),
        endTime: TimeFormatter.secondsToTime((currentTime || state.currentTime) + 30),
        tags: ''
      };
      
      reset(newValues);
    }
  }, [segment, state.currentVideo?.id, state.currentTime, currentTime, reset]);

  // 시간만 변경될 때는 시간 필드만 업데이트 (비디오 변경이 아닌 경우)
  useEffect(() => {
    if (!segment && state.currentVideo && (currentTime || state.currentTime)) {
      setValue('startTime', TimeFormatter.secondsToTime(currentTime || state.currentTime));
      setValue('endTime', TimeFormatter.secondsToTime((currentTime || state.currentTime) + 30));
    }
  }, [currentTime, state.currentTime, segment, state.currentVideo, setValue]);

  const handleFormSubmit = async (data: SegmentFormData) => {
    try {
      const formattedData: CreateSegmentRequest | UpdateSegmentRequest = {
        title: data.title.trim(),
        description: data.description?.trim() || undefined,
        startTime: TimeFormatter.timeToSeconds(data.startTime),
        endTime: TimeFormatter.timeToSeconds(data.endTime),
        tags: data.tags
          ? data.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
          : []
      };

      await onSubmit(formattedData);
      if (!segment) {
        reset(); // 새 세그먼트 생성 시에만 폼 리셋
      }
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 bg-white border rounded-lg p-6">
      <div className="space-y-2">
        <Label htmlFor="title">제목 *</Label>
        <Input
          id="title"
          {...register('title')}
          placeholder="세그먼트 제목을 입력하세요"
          disabled={loading || isSubmitting}
        />
        {errors.title && (
          <p className="text-sm text-red-600">{errors.title.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="description">설명 (선택사항)</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
            className="h-auto p-1 text-gray-500 hover:text-gray-700"
          >
            {isDescriptionExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
        {isDescriptionExpanded && (
          <Textarea
            id="description"
            {...register('description')}
            placeholder="세그먼트에 대한 설명을 입력하세요"
            rows={3}
            disabled={loading || isSubmitting}
          />
        )}
        {errors.description && (
          <p className="text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startTime">시작 시간 *</Label>
          <Input
            id="startTime"
            {...register('startTime')}
            placeholder="0:00"
            disabled={loading || isSubmitting}
          />
          {errors.startTime && (
            <p className="text-sm text-red-600">{errors.startTime.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="endTime">종료 시간 *</Label>
          <Input
            id="endTime"
            {...register('endTime')}
            placeholder="0:30"
            disabled={loading || isSubmitting}
          />
          {errors.endTime && (
            <p className="text-sm text-red-600">{errors.endTime.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tags">태그</Label>
        <Input
          id="tags"
          {...register('tags')}
          placeholder="태그1, 태그2, 태그3 (쉼표로 구분)"
          disabled={loading || isSubmitting}
        />
        <p className="text-xs text-gray-500">
          쉼표(,)로 구분하여 여러 태그를 입력할 수 있습니다.
        </p>
        {errors.tags && (
          <p className="text-sm text-red-600">{errors.tags.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading || isSubmitting}
        >
          취소
        </Button>
        <Button
          type="submit"
          disabled={loading || isSubmitting}
        >
          {isSubmitting ? '저장 중...' : segment ? '수정' : '추가'}
        </Button>
      </div>
    </form>
  );
};

export default SegmentForm; 