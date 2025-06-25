'use client';

import React, { createContext, useContext, useReducer, useMemo, type ReactNode } from 'react';
import { Project } from '@/types/services';

// App 상태 타입 정의
interface AppState {
  loading: boolean;
  error: string | null;
  currentProject: Project | null;
}

// App 액션 타입 정의
type AppAction = 
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CURRENT_PROJECT'; payload: Project | null };

// App 컨텍스트 값 타입
interface AppContextValue {
  state: AppState;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCurrentProject: (project: Project | null) => void;
}

// 초기 상태
const initialState: AppState = {
  loading: false,
  error: null,
  currentProject: null,
};

// Reducer 함수
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_CURRENT_PROJECT':
      return { ...state, currentProject: action.payload };
    default:
      return state;
  }
}

// Context 생성
const AppContext = createContext<AppContextValue | undefined>(undefined);

// Provider Props
interface AppProviderProps {
  children: ReactNode;
}

// App Provider 구현
export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const setLoading = (loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  };

  const setError = (error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  };

  const setCurrentProject = (currentProject: Project | null) => {
    dispatch({ type: 'SET_CURRENT_PROJECT', payload: currentProject });
  };

  const value: AppContextValue = useMemo(() => ({
    state,
    setLoading,
    setError,
    setCurrentProject,
  }), [state]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

// App Hook
export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

// Selector hooks
export function useAppLoading() {
  const { state } = useApp();
  return state.loading;
}

export function useAppError() {
  const { state } = useApp();
  return state.error;
}

export function useCurrentProject() {
  const { state } = useApp();
  return state.currentProject;
} 