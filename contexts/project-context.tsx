'use client';

import React, { createContext, useContext, useReducer, type ReactNode } from 'react';
import { Project } from '@/types/services';

// Project 상태 타입 정의
interface ProjectState {
  projects: Project[];
  currentProjectId: string | null;
}

// Project 액션 타입 정의
type ProjectAction = 
  | { type: 'SET_PROJECTS'; payload: Project[] }
  | { type: 'SET_CURRENT_PROJECT_ID'; payload: string | null }
  | { type: 'ADD_PROJECT'; payload: Project }
  | { type: 'UPDATE_PROJECT'; payload: { projectId: string; updates: Partial<Project> } }
  | { type: 'REMOVE_PROJECT'; payload: string };

// Project 컨텍스트 값 타입
interface ProjectContextValue {
  state: ProjectState;
  setProjects: (projects: Project[]) => void;
  setCurrentProjectId: (projectId: string | null) => void;
  addProject: (project: Project) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  removeProject: (projectId: string) => void;
  getCurrentProject: () => Project | null;
}

// 초기 상태
const initialState: ProjectState = {
  projects: [],
  currentProjectId: null,
};

// Reducer 함수
function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  switch (action.type) {
    case 'SET_PROJECTS':
      return { ...state, projects: action.payload };
    case 'SET_CURRENT_PROJECT_ID':
      return { ...state, currentProjectId: action.payload };
    case 'ADD_PROJECT':
      return {
        ...state,
        projects: [...state.projects, action.payload],
      };
    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map(project =>
          project.id === action.payload.projectId 
            ? { ...project, ...action.payload.updates } 
            : project
        ),
      };
    case 'REMOVE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter(project => project.id !== action.payload),
        currentProjectId: state.currentProjectId === action.payload ? null : state.currentProjectId,
      };
    default:
      return state;
  }
}

// Context 생성
const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

// Provider Props
interface ProjectProviderProps {
  children: ReactNode;
}

// Project Provider 구현
export function ProjectProvider({ children }: ProjectProviderProps) {
  const [state, dispatch] = useReducer(projectReducer, initialState);

  const setProjects = (projects: Project[]) => {
    dispatch({ type: 'SET_PROJECTS', payload: projects });
  };

  const setCurrentProjectId = (currentProjectId: string | null) => {
    dispatch({ type: 'SET_CURRENT_PROJECT_ID', payload: currentProjectId });
  };

  const addProject = (project: Project) => {
    dispatch({ type: 'ADD_PROJECT', payload: project });
  };

  const updateProject = (projectId: string, updates: Partial<Project>) => {
    dispatch({ type: 'UPDATE_PROJECT', payload: { projectId, updates } });
  };

  const removeProject = (projectId: string) => {
    dispatch({ type: 'REMOVE_PROJECT', payload: projectId });
  };

  const getCurrentProject = (): Project | null => {
    if (!state.currentProjectId) return null;
    return state.projects.find(project => project.id === state.currentProjectId) || null;
  };

  const value: ProjectContextValue = {
    state,
    setProjects,
    setCurrentProjectId,
    addProject,
    updateProject,
    removeProject,
    getCurrentProject,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

// Project Hook
export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}

// Selector hooks
export function useProjectList() {
  const { state } = useProject();
  return state.projects;
}

export function useCurrentProjectId() {
  const { state } = useProject();
  return state.currentProjectId;
}

export function useCurrentProjectData() {
  const { getCurrentProject } = useProject();
  return getCurrentProject();
} 