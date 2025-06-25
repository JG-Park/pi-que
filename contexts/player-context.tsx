'use client';

import React, { createContext, useContext, useReducer, type ReactNode } from 'react';

// Player 상태 타입 정의
interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  // 현재 비디오 정보 추가
  currentVideo: {
    id: string;
    title: string;
    url: string;
  } | null;
}

// Player 액션 타입 정의
type PlayerAction = 
  | { type: 'SET_IS_PLAYING'; payload: boolean }
  | { type: 'SET_CURRENT_TIME'; payload: number }
  | { type: 'SET_DURATION'; payload: number }
  | { type: 'SET_VOLUME'; payload: number }
  | { type: 'SET_PLAYBACK_RATE'; payload: number }
  | { type: 'SET_CURRENT_VIDEO'; payload: { id: string; title: string; url: string } | null }
  | { type: 'UPDATE_PLAYER_STATE'; payload: Partial<PlayerState> };

// Player 컨텍스트 값 타입
interface PlayerContextValue {
  state: PlayerState;
  setIsPlaying: (isPlaying: boolean) => void;
  setCurrentTime: (currentTime: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (playbackRate: number) => void;
  setCurrentVideo: (video: { id: string; title: string; url: string } | null) => void;
  updatePlayerState: (updates: Partial<PlayerState>) => void;
}

// 초기 상태
const initialState: PlayerState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 100,
  playbackRate: 1,
  currentVideo: null,
};

// Reducer 함수
function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case 'SET_IS_PLAYING':
      return { ...state, isPlaying: action.payload };
    case 'SET_CURRENT_TIME':
      return { ...state, currentTime: action.payload };
    case 'SET_DURATION':
      return { ...state, duration: action.payload };
    case 'SET_VOLUME':
      return { ...state, volume: action.payload };
    case 'SET_PLAYBACK_RATE':
      return { ...state, playbackRate: action.payload };
    case 'SET_CURRENT_VIDEO':
      return { ...state, currentVideo: action.payload };
    case 'UPDATE_PLAYER_STATE':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

// Context 생성
const PlayerContext = createContext<PlayerContextValue | undefined>(undefined);

// Provider Props
interface PlayerProviderProps {
  children: ReactNode;
}

// Player Provider 구현
export function PlayerProvider({ children }: PlayerProviderProps) {
  const [state, dispatch] = useReducer(playerReducer, initialState);

  const setIsPlaying = (isPlaying: boolean) => {
    dispatch({ type: 'SET_IS_PLAYING', payload: isPlaying });
  };

  const setCurrentTime = (currentTime: number) => {
    dispatch({ type: 'SET_CURRENT_TIME', payload: currentTime });
  };

  const setDuration = (duration: number) => {
    dispatch({ type: 'SET_DURATION', payload: duration });
  };

  const setVolume = (volume: number) => {
    dispatch({ type: 'SET_VOLUME', payload: volume });
  };

  const setPlaybackRate = (playbackRate: number) => {
    dispatch({ type: 'SET_PLAYBACK_RATE', payload: playbackRate });
  };

  const setCurrentVideo = (video: { id: string; title: string; url: string } | null) => {
    dispatch({ type: 'SET_CURRENT_VIDEO', payload: video });
  };

  const updatePlayerState = (updates: Partial<PlayerState>) => {
    dispatch({ type: 'UPDATE_PLAYER_STATE', payload: updates });
  };

  const value: PlayerContextValue = {
    state,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setVolume,
    setPlaybackRate,
    setCurrentVideo,
    updatePlayerState,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
}

// Player Hook
export function usePlayer() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}

// Selector hooks
export function usePlayerState() {
  const { state } = usePlayer();
  return state.isPlaying;
}

export function usePlayerTime() {
  const { state } = usePlayer();
  return { currentTime: state.currentTime, duration: state.duration };
}

export function usePlayerControls() {
  const { state } = usePlayer();
  return { volume: state.volume, playbackRate: state.playbackRate };
} 