'use client';

import React, { useState, useCallback } from 'react';
import { Project, UpdateProjectRequest } from '@/types/services';
import { ErrorHandler } from '@/utils/common/error-handler';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Info, FileText } from 'lucide-react';
import ProjectInfo from './ProjectInfo';
import ProjectSettings from './ProjectSettings';
import ProjectActions from './ProjectActions';

interface ProjectManagerProps {
  projectId: string;
  project?: Project;
  onProjectChange?: (project: Project) => void;
}

const ProjectManager: React.FC<ProjectManagerProps> = ({
  projectId,
  project: initialProject,
  onProjectChange
}) => {
  const [project, setProject] = useState<Project | null>(initialProject || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('info');

  // 프로젝트 상태 업데이트 헬퍼
  const updateProject = useCallback((updatedProject: Project) => {
    setProject(updatedProject);
    onProjectChange?.(updatedProject);
  }, [onProjectChange]);

  // 프로젝트 정보 업데이트
  const handleUpdateProject = useCallback(async (updates: UpdateProjectRequest): Promise<void> => {
    if (!project) return;

    try {
      setLoading(true);
      setError(null);

      // 낙관적 업데이트
      const updatedProject: Project = {
        ...project,
        ...updates,
        settings: {
          ...project.settings,
          ...updates.settings
        },
        metadata: {
          ...project.metadata,
          updatedAt: new Date()
        }
      };

      updateProject(updatedProject);

      // TODO: API 호출로 서버에 저장
      // await projectService.updateProject(projectId, updates);

    } catch (error) {
      ErrorHandler.handle(error as Error, { context: 'UpdateProject', projectId });
      setError('프로젝트 업데이트에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [project, updateProject, projectId]);

  // 프로젝트 삭제
  const handleDeleteProject = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      // TODO: API 호출로 서버에서 삭제
      // await projectService.deleteProject(projectId);

      // 삭제 성공 시 상위 컴포넌트에 알림
      onProjectChange?.(null as any);

    } catch (error) {
      ErrorHandler.handle(error as Error, { context: 'DeleteProject', projectId });
      setError('프로젝트 삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [projectId, onProjectChange]);

  // 프로젝트 복제
  const handleDuplicateProject = useCallback(async (newName: string): Promise<void> => {
    if (!project) return;

    try {
      setLoading(true);
      setError(null);

      // TODO: API 호출로 프로젝트 복제
      // const duplicatedProject = await projectService.duplicateProject(projectId, newName);
      // updateProject(duplicatedProject);

    } catch (error) {
      ErrorHandler.handle(error as Error, { context: 'DuplicateProject', projectId });
      setError('프로젝트 복제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [project, projectId, updateProject]);

  // 프로젝트 내보내기
  const handleExportProject = useCallback(async (format: 'json' | 'csv'): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      // TODO: API 호출로 프로젝트 내보내기
      // const exportResult = await projectService.exportProject(projectId, format);
      
      // 다운로드 트리거
      // const blob = new Blob([exportResult.data], { type: 'application/json' });
      // const url = URL.createObjectURL(blob);
      // const a = document.createElement('a');
      // a.href = url;
      // a.download = exportResult.filename;
      // a.click();
      // URL.revokeObjectURL(url);

    } catch (error) {
      ErrorHandler.handle(error as Error, { context: 'ExportProject', projectId });
      setError('프로젝트 내보내기에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  if (!project) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>프로젝트 관리</CardTitle>
          <CardDescription>프로젝트를 불러오는 중입니다...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="project-manager space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{project.name}</h2>
          <p className="text-gray-600 text-sm">프로젝트 관리</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="info" className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            정보
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            설정
          </TabsTrigger>
          <TabsTrigger value="actions" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            작업
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4">
          <ProjectInfo 
            project={project}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <ProjectSettings 
            project={project}
            loading={loading}
            onUpdate={handleUpdateProject}
          />
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <ProjectActions 
            project={project}
            loading={loading}
            onDelete={handleDeleteProject}
            onDuplicate={handleDuplicateProject}
            onExport={handleExportProject}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProjectManager; 