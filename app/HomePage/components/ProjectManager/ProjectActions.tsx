'use client';

import React, { useState } from 'react';
import { Project } from '@/types/services';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Copy, 
  Download, 
  Trash2, 
  AlertTriangle, 
  FileText, 
  Share2 
} from 'lucide-react';

interface ProjectActionsProps {
  project: Project;
  loading?: boolean;
  onDelete: () => Promise<void>;
  onDuplicate: (newName: string) => Promise<void>;
  onExport: (format: 'json' | 'csv') => Promise<void>;
}

const ProjectActions: React.FC<ProjectActionsProps> = ({
  project,
  loading = false,
  onDelete,
  onDuplicate,
  onExport
}) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [duplicateName, setDuplicateName] = useState(`${project.name} (복사본)`);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleDelete = async () => {
    try {
      setActionLoading('delete');
      await onDelete();
      setIsDeleteDialogOpen(false);
    } catch (error) {
      // 에러는 상위 컴포넌트에서 처리
    } finally {
      setActionLoading(null);
    }
  };

  const handleDuplicate = async () => {
    if (!duplicateName.trim()) return;
    
    try {
      setActionLoading('duplicate');
      await onDuplicate(duplicateName);
      setIsDuplicateDialogOpen(false);
      setDuplicateName(`${project.name} (복사본)`);
    } catch (error) {
      // 에러는 상위 컴포넌트에서 처리
    } finally {
      setActionLoading(null);
    }
  };

  const handleExport = async () => {
    try {
      setActionLoading('export');
      await onExport(exportFormat);
      setIsExportDialogOpen(false);
    } catch (error) {
      // 에러는 상위 컴포넌트에서 처리
    } finally {
      setActionLoading(null);
    }
  };

  const getProjectShareUrl = () => {
    // TODO: 실제 공유 URL 구현
    return `${window.location.origin}/shared/${project.id}`;
  };

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(getProjectShareUrl());
      // TODO: 토스트 메시지 표시
    } catch (error) {
      console.error('URL 복사 실패:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* 일반 작업 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            프로젝트 작업
          </CardTitle>
          <CardDescription>프로젝트 복제, 내보내기, 공유 기능</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 복제 버튼 */}
            <Dialog open={isDuplicateDialogOpen} onOpenChange={setIsDuplicateDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="flex items-center gap-2 h-auto p-4"
                  disabled={loading}
                >
                  <Copy className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-medium">프로젝트 복제</div>
                    <div className="text-sm text-gray-500">현재 프로젝트를 복사합니다</div>
                  </div>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>프로젝트 복제</DialogTitle>
                  <DialogDescription>
                    새로운 프로젝트로 복제됩니다. 복제된 프로젝트는 현재 프로젝트의 모든 세그먼트와 설정을 포함합니다.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="duplicate-name">새 프로젝트 이름</Label>
                    <Input
                      id="duplicate-name"
                      value={duplicateName}
                      onChange={(e) => setDuplicateName(e.target.value)}
                      placeholder="복제할 프로젝트의 이름을 입력하세요"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsDuplicateDialogOpen(false)}
                    disabled={actionLoading === 'duplicate'}
                  >
                    취소
                  </Button>
                  <Button 
                    onClick={handleDuplicate}
                    disabled={!duplicateName.trim() || actionLoading === 'duplicate'}
                  >
                    {actionLoading === 'duplicate' ? '복제 중...' : '복제'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* 내보내기 버튼 */}
            <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="flex items-center gap-2 h-auto p-4"
                  disabled={loading}
                >
                  <Download className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-medium">프로젝트 내보내기</div>
                    <div className="text-sm text-gray-500">데이터를 파일로 저장합니다</div>
                  </div>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>프로젝트 내보내기</DialogTitle>
                  <DialogDescription>
                    프로젝트 데이터를 파일로 내보냅니다. 다른 시스템에서 가져올 수 있습니다.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="export-format">내보내기 형식</Label>
                    <Select value={exportFormat} onValueChange={(value: 'json' | 'csv') => setExportFormat(value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="형식을 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="json">JSON (전체 데이터)</SelectItem>
                        <SelectItem value="csv">CSV (세그먼트 목록)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsExportDialogOpen(false)}
                    disabled={actionLoading === 'export'}
                  >
                    취소
                  </Button>
                  <Button 
                    onClick={handleExport}
                    disabled={actionLoading === 'export'}
                  >
                    {actionLoading === 'export' ? '내보내는 중...' : '내보내기'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* 공유 버튼 */}
            <Button 
              variant="outline" 
              className="flex items-center gap-2 h-auto p-4"
              onClick={copyShareUrl}
              disabled={loading || project.settings.visibility === 'private'}
            >
              <Share2 className="h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">공유 링크 복사</div>
                <div className="text-sm text-gray-500">
                  {project.settings.visibility === 'private' 
                    ? '비공개 프로젝트입니다' 
                    : '링크를 클립보드에 복사합니다'
                  }
                </div>
              </div>
            </Button>
          </div>

          {project.settings.visibility !== 'private' && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>공유 URL:</strong> {getProjectShareUrl()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 위험한 작업 */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            위험한 작업
          </CardTitle>
          <CardDescription className="text-red-600">
            아래 작업들은 되돌릴 수 없습니다. 신중하게 진행하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="destructive" 
                className="flex items-center gap-2"
                disabled={loading}
              >
                <Trash2 className="h-4 w-4" />
                프로젝트 삭제
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-5 w-5" />
                  프로젝트 삭제 확인
                </DialogTitle>
                <DialogDescription>
                  <strong className="text-red-600">"{project.name}"</strong> 프로젝트를 완전히 삭제합니다.
                  <br />
                  <br />
                  이 작업은 <strong>되돌릴 수 없으며</strong>, 다음 데이터가 모두 삭제됩니다:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>모든 세그먼트 ({project.segments?.length || 0}개)</li>
                    <li>큐 아이템 ({project.queue?.length || 0}개)</li>
                    <li>프로젝트 설정 및 메타데이터</li>
                  </ul>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setIsDeleteDialogOpen(false)}
                  disabled={actionLoading === 'delete'}
                >
                  취소
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleDelete}
                  disabled={actionLoading === 'delete'}
                >
                  {actionLoading === 'delete' ? '삭제 중...' : '삭제'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectActions; 