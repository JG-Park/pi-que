'use client';

import { type ReactNode } from 'react';
import { AppProvider } from './app-context';
import { PlayerProvider } from './player-context';
import { ProjectProvider } from './project-context';

interface StateProvidersProps {
  children: ReactNode;
}

/**
 * 모든 상태 관리 Context를 통합하는 Provider
 * 앱의 루트에서 사용하여 전역 상태 관리를 활성화합니다.
 */
export function StateProviders({ children }: StateProvidersProps) {
  return (
    <AppProvider>
      <PlayerProvider>
        <ProjectProvider>
          {children}
        </ProjectProvider>
      </PlayerProvider>
    </AppProvider>
  );
}

// 편의를 위한 내보내기
export { useApp, useAppLoading, useAppError, useCurrentProject } from './app-context';
export { usePlayer, usePlayerState, usePlayerTime, usePlayerControls } from './player-context';
export { useProject, useProjectList, useCurrentProjectId, useCurrentProjectData } from './project-context'; 