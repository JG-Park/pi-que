# State Management Design Document

## Overview
글로벌 상태 관리를 위한 최소한의 Context 구조 설계입니다. 빠른 출시에 집중하여 복잡한 최적화는 추후 추가합니다.

## Required Contexts

### 1. AppContext (핵심 앱 상태)
- 현재 프로젝트 정보
- 전역 로딩 상태
- 에러 상태

### 2. PlayerContext (비디오 플레이어 상태)  
- 재생 상태 (playing, paused, stopped)
- 현재 시간, 전체 시간
- 볼륨, 재생 속도

### 3. ProjectContext (프로젝트 관리)
- 현재 선택된 프로젝트
- 프로젝트 목록 (간단한 캐시)

## State Shape (Simplified)

```typescript
// AppState
interface AppState {
  loading: boolean;
  error: string | null;
  currentProject: Project | null;
}

// PlayerState  
interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
}

// ProjectState
interface ProjectState {
  projects: Project[];
  currentProjectId: string | null;
}
```

## Implementation Plan
1. 기본 Context + Provider 구현
2. useReducer 패턴 적용
3. 기본 selector 함수 추가
4. 간단한 성능 최적화 (React.memo)
5. TypeScript 타입 정의
6. 기본 테스트 작성

## Testing Strategy (Minimal)
- Reducer 함수 단위 테스트만 작성
- Context Provider 마운트 테스트 1개
- 통합 테스트는 생략하고 추후 추가 