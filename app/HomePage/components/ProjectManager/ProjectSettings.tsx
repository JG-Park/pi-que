'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Project, UpdateProjectRequest } from '@/types/services';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Settings, Save } from 'lucide-react';

interface ProjectSettingsProps {
  project: Project;
  loading?: boolean;
  onUpdate: (updates: UpdateProjectRequest) => Promise<void>;
}

interface ProjectSettingsFormData {
  name: string;
  description: string;
  videoUrl: string;
  autoSave: boolean;
  autoSaveInterval: number;
  defaultVolume: number;
  playbackRate: number;
  theme: 'light' | 'dark' | 'auto';
  visibility: 'private' | 'public' | 'unlisted';
}

const ProjectSettings: React.FC<ProjectSettingsProps> = ({ 
  project, 
  loading = false, 
  onUpdate 
}) => {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty, isSubmitting }
  } = useForm<ProjectSettingsFormData>({
    defaultValues: {
      name: project.name,
      description: project.description || '',
      videoUrl: project.videoUrl,
      autoSave: project.settings.autoSave,
      autoSaveInterval: project.settings.autoSaveInterval,
      defaultVolume: project.settings.defaultVolume,
      playbackRate: project.settings.playbackRate,
      theme: project.settings.theme,
      visibility: project.settings.visibility
    }
  });

  const watchedAutoSave = watch('autoSave');

  // 프로젝트가 변경되면 폼 값 업데이트
  useEffect(() => {
    setValue('name', project.name);
    setValue('description', project.description || '');
    setValue('videoUrl', project.videoUrl);
    setValue('autoSave', project.settings.autoSave);
    setValue('autoSaveInterval', project.settings.autoSaveInterval);
    setValue('defaultVolume', project.settings.defaultVolume);
    setValue('playbackRate', project.settings.playbackRate);
    setValue('theme', project.settings.theme);
    setValue('visibility', project.settings.visibility);
  }, [project, setValue]);

  const onSubmit = async (data: ProjectSettingsFormData) => {
    const updates: UpdateProjectRequest = {
      name: data.name,
      description: data.description,
      videoUrl: data.videoUrl,
      settings: {
        autoSave: data.autoSave,
        autoSaveInterval: data.autoSaveInterval,
        defaultVolume: data.defaultVolume,
        playbackRate: data.playbackRate,
        theme: data.theme,
        visibility: data.visibility
      }
    };

    await onUpdate(updates);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            프로젝트 설정
          </CardTitle>
          <CardDescription>프로젝트 기본 정보와 설정을 관리합니다</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* 기본 정보 */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">기본 정보</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">프로젝트 이름 *</Label>
                  <Input
                    id="name"
                    {...register('name', { required: '프로젝트 이름은 필수입니다' })}
                    disabled={loading || isSubmitting}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="videoUrl">비디오 URL *</Label>
                  <Input
                    id="videoUrl"
                    type="url"
                    {...register('videoUrl', { 
                      required: '비디오 URL은 필수입니다',
                      pattern: {
                        value: /^https?:\/\/.+/,
                        message: '올바른 URL 형식을 입력하세요'
                      }
                    })}
                    disabled={loading || isSubmitting}
                  />
                  {errors.videoUrl && (
                    <p className="text-sm text-red-600">{errors.videoUrl.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">설명</Label>
                <Textarea
                  id="description"
                  {...register('description')}
                  rows={3}
                  disabled={loading || isSubmitting}
                  placeholder="프로젝트에 대한 설명을 입력하세요"
                />
              </div>
            </div>

            {/* 공개 설정 */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">공개 설정</h3>
              
              <div className="space-y-2">
                <Label htmlFor="visibility">가시성</Label>
                <Select
                  value={watch('visibility')}
                  onValueChange={(value: 'private' | 'public' | 'unlisted') => setValue('visibility', value)}
                  disabled={loading || isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="가시성을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">비공개</SelectItem>
                    <SelectItem value="public">공개</SelectItem>
                    <SelectItem value="unlisted">제한된 공개</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 재생 설정 */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">재생 설정</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="defaultVolume">기본 음량 ({watch('defaultVolume')}%)</Label>
                  <Input
                    id="defaultVolume"
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    {...register('defaultVolume', {
                      valueAsNumber: true,
                      min: { value: 0, message: '음량은 0 이상이어야 합니다' },
                      max: { value: 100, message: '음량은 100 이하여야 합니다' }
                    })}
                    disabled={loading || isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="playbackRate">재생 속도</Label>
                  <Select
                    value={watch('playbackRate').toString()}
                    onValueChange={(value) => setValue('playbackRate', parseFloat(value))}
                    disabled={loading || isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.25">0.25x</SelectItem>
                      <SelectItem value="0.5">0.5x</SelectItem>
                      <SelectItem value="0.75">0.75x</SelectItem>
                      <SelectItem value="1">1x (기본)</SelectItem>
                      <SelectItem value="1.25">1.25x</SelectItem>
                      <SelectItem value="1.5">1.5x</SelectItem>
                      <SelectItem value="1.75">1.75x</SelectItem>
                      <SelectItem value="2">2x</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 자동 저장 설정 */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">자동 저장 설정</h3>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="autoSave"
                  checked={watchedAutoSave}
                  onCheckedChange={(checked) => setValue('autoSave', checked)}
                  disabled={loading || isSubmitting}
                />
                <Label htmlFor="autoSave">자동 저장 활성화</Label>
              </div>

              {watchedAutoSave && (
                <div className="space-y-2">
                  <Label htmlFor="autoSaveInterval">
                    자동 저장 간격 ({watch('autoSaveInterval')}초)
                  </Label>
                  <Input
                    id="autoSaveInterval"
                    type="range"
                    min="30"
                    max="300"
                    step="30"
                    {...register('autoSaveInterval', {
                      valueAsNumber: true,
                      min: { value: 30, message: '최소 30초 이상이어야 합니다' },
                      max: { value: 300, message: '최대 300초 이하여야 합니다' }
                    })}
                    disabled={loading || isSubmitting}
                  />
                </div>
              )}
            </div>

            {/* 테마 설정 */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">테마 설정</h3>
              
              <div className="space-y-2">
                <Label htmlFor="theme">테마</Label>
                <Select
                  value={watch('theme')}
                  onValueChange={(value: 'light' | 'dark' | 'auto') => setValue('theme', value)}
                  disabled={loading || isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">라이트</SelectItem>
                    <SelectItem value="dark">다크</SelectItem>
                    <SelectItem value="auto">시스템 설정</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 저장 버튼 */}
            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={!isDirty || loading || isSubmitting}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {isSubmitting ? '저장 중...' : '변경사항 저장'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectSettings; 