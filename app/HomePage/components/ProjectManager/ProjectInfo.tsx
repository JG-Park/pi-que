'use client';

import React from 'react';
import { Project } from '@/types/services';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Video, Users } from 'lucide-react';
import { formatDuration } from '@/utils/time/formatDuration';

interface ProjectInfoProps {
  project: Project;
  loading?: boolean;
}

const ProjectInfo: React.FC<ProjectInfoProps> = ({ project, loading = false }) => {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const getProjectStats = () => {
    return {
      segments: project.segments?.length || 0,
      queue: project.queue?.length || 0,
      totalDuration: project.segments?.reduce((acc, segment) => acc + (segment.endTime - segment.startTime), 0) || 0
    };
  };

  const stats = getProjectStats();

  return (
    <div className="space-y-6">
      {/* 기본 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            프로젝트 정보
          </CardTitle>
          <CardDescription>프로젝트의 기본 정보와 현재 상태</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">프로젝트 이름</label>
              <p className="text-lg font-semibold">{project.name}</p>
            </div>
            
            {project.description && (
              <div>
                <label className="text-sm font-medium text-gray-700">설명</label>
                <p className="text-gray-600">{project.description}</p>
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium text-gray-700">비디오 URL</label>
              <a 
                href={project.videoUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 truncate block"
              >
                {project.videoUrl}
              </a>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">가시성</label>
              <Badge variant={project.settings.visibility === 'private' ? 'secondary' : 'default'}>
                {project.settings.visibility === 'private' ? '비공개' : 
                 project.settings.visibility === 'public' ? '공개' : '제한된 공개'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 비디오 정보 */}
      {project.videoInfo && (
        <Card>
          <CardHeader>
            <CardTitle>비디오 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">제목</label>
                <p className="font-medium">{project.videoInfo.title}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700">채널</label>
                <p className="text-gray-600">{project.videoInfo.channelTitle}</p>
              </div>
              
                             <div>
                 <label className="text-sm font-medium text-gray-700">재생 시간</label>
                 <p className="text-gray-600">{formatDuration(typeof project.videoInfo.duration === 'number' ? project.videoInfo.duration : 0)}</p>
               </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700">조회수</label>
                <p className="text-gray-600">{(project.videoInfo.viewCount || 0).toLocaleString('ko-KR')}회</p>
              </div>
            </div>
            
            {project.videoInfo.description && (
              <div>
                <label className="text-sm font-medium text-gray-700">설명</label>
                <p className="text-gray-600 text-sm max-h-32 overflow-y-auto">
                  {project.videoInfo.description}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 프로젝트 통계 */}
      <Card>
        <CardHeader>
          <CardTitle>프로젝트 통계</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.segments}</div>
              <div className="text-sm text-gray-600">세그먼트</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.queue}</div>
              <div className="text-sm text-gray-600">큐 아이템</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{formatDuration(stats.totalDuration)}</div>
              <div className="text-sm text-gray-600">총 재생 시간</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 메타데이터 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            메타데이터
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span className="text-gray-600">생성일:</span>
            <span>{formatDate(project.metadata.createdAt)}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-gray-500" />
            <span className="text-gray-600">수정일:</span>
            <span>{formatDate(project.metadata.updatedAt)}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span className="text-gray-600">마지막 접근:</span>
            <span>{formatDate(project.metadata.lastAccessedAt)}</span>
          </div>

          {project.metadata.owner && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600">소유자:</span>
              <span>{project.metadata.owner}</span>
            </div>
          )}

          {project.metadata.collaborators && project.metadata.collaborators.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600">협업자:</span>
              <span>{project.metadata.collaborators.join(', ')}</span>
            </div>
          )}

          {project.metadata.tags && project.metadata.tags.length > 0 && (
            <div className="space-y-2">
              <span className="text-sm text-gray-600">태그:</span>
              <div className="flex flex-wrap gap-2">
                {project.metadata.tags.map((tag, index) => (
                  <Badge key={index} variant="outline">{tag}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectInfo; 