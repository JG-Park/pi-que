'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { OnProgressProps, VideoPlayerState, VideoPlayerProps, VideoMetadata } from '@/types/video-player';
import VideoControls from './VideoControls';
import VideoInfo from './VideoInfo';

export default function VideoPlayer({
  url,
  onProgress,
  onDuration,
  onEnded,
  onPlay,
  onPause,
  onReady,
  className = '',
  showInfo = false,
  enableKeyboardShortcuts = true,
  ...props
}: VideoPlayerProps & { 
  showInfo?: boolean;
  enableKeyboardShortcuts?: boolean;
}) {
  const playerRef = useRef<ReactPlayer>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [state, setState] = useState<VideoPlayerState>({
    playing: false,
    muted: false,
    volume: 0.8,
    playbackRate: 1,
    played: 0,
    loaded: 0,
    duration: 0,
    seeking: false,
    pip: false,
    controls: false,
  });

  const [metadata, setMetadata] = useState<VideoMetadata | undefined>(undefined);
  const [showVideoInfo, setShowVideoInfo] = useState(showInfo);
  const [isFocused, setIsFocused] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);

  // PiP 지원 여부 확인
  useEffect(() => {
    const checkPipSupport = () => {
      const isSupported = 'pictureInPictureEnabled' in document && 
                          document.pictureInPictureEnabled !== false;
      setPipSupported(isSupported);
    };

    checkPipSupport();
  }, []);

  // PiP 이벤트 리스너 설정
  useEffect(() => {
    const handleEnterPiP = () => {
      setState((prev: VideoPlayerState) => ({ ...prev, pip: true }));
    };

    const handleLeavePiP = () => {
      setState((prev: VideoPlayerState) => ({ ...prev, pip: false }));
    };

    // 브라우저 PiP 이벤트 리스너 등록
    document.addEventListener('enterpictureinpicture', handleEnterPiP);
    document.addEventListener('leavepictureinpicture', handleLeavePiP);

    return () => {
      document.removeEventListener('enterpictureinpicture', handleEnterPiP);
      document.removeEventListener('leavepictureinpicture', handleLeavePiP);
    };
  }, []);

  const handlePlay = useCallback(() => {
    setState((prev: VideoPlayerState) => ({ ...prev, playing: true }));
    onPlay?.();
  }, [onPlay]);

  const handlePause = useCallback(() => {
    setState((prev: VideoPlayerState) => ({ ...prev, playing: false }));
    onPause?.();
  }, [onPause]);

  const handleProgress = useCallback((progress: OnProgressProps) => {
    if (!state.seeking) {
      setState((prev: VideoPlayerState) => ({ 
        ...prev, 
        played: progress.played,
        loaded: progress.loaded 
      }));
    }
    onProgress?.(progress);
  }, [state.seeking, onProgress]);

  const handleDuration = useCallback((duration: number) => {
    setState((prev: VideoPlayerState) => ({ ...prev, duration }));
    onDuration?.(duration);
  }, [onDuration]);

  const handleEnded = useCallback(() => {
    setState((prev: VideoPlayerState) => ({ ...prev, playing: false }));
    onEnded?.();
  }, [onEnded]);

  const handleReady = useCallback(() => {
    onReady?.();
  }, [onReady]);

  const togglePlay = useCallback(() => {
    setState((prev: VideoPlayerState) => ({ ...prev, playing: !prev.playing }));
  }, []);

  const toggleMute = useCallback(() => {
    setState((prev: VideoPlayerState) => ({ ...prev, muted: !prev.muted }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    setState((prev: VideoPlayerState) => ({ ...prev, volume: Math.max(0, Math.min(1, volume)) }));
  }, []);

  const setPlaybackRate = useCallback((playbackRate: number) => {
    setState((prev: VideoPlayerState) => ({ ...prev, playbackRate }));
  }, []);

  const seekTo = useCallback((played: number) => {
    setState((prev: VideoPlayerState) => ({ ...prev, played }));
    playerRef.current?.seekTo(played);
  }, []);

  const handleSeekStart = useCallback(() => {
    setState((prev: VideoPlayerState) => ({ ...prev, seeking: true }));
  }, []);

  const handleSeekEnd = useCallback(() => {
    setState((prev: VideoPlayerState) => ({ ...prev, seeking: false }));
  }, []);

  const togglePiP = useCallback(async () => {
    if (!pipSupported) {
      console.warn('Picture-in-Picture is not supported in this browser');
      return;
    }

    try {
      const player = playerRef.current?.getInternalPlayer();
      
      if (!player || !('requestPictureInPicture' in player)) {
        console.warn('Video element does not support Picture-in-Picture');
        return;
      }

      if (state.pip) {
        // PiP 모드 종료
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        }
      } else {
        // PiP 모드 진입
        if (document.pictureInPictureElement) {
          // 이미 다른 비디오가 PiP 모드인 경우 먼저 종료
          await document.exitPictureInPicture();
        }
        
        await (player as HTMLVideoElement).requestPictureInPicture();
      }
    } catch (error) {
      console.error('Failed to toggle Picture-in-Picture:', error);
      
      // 에러 발생 시 상태 원복
      setState((prev: VideoPlayerState) => ({ ...prev, pip: false }));
      
      // 사용자에게 알림 (선택적)
      if (error instanceof Error && error.name === 'NotAllowedError') {
        console.warn('Picture-in-Picture was denied by user or browser policy');
      }
    }
  }, [state.pip, pipSupported]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  }, []);

  const handleMetadataLoad = useCallback((newMetadata: VideoMetadata) => {
    setMetadata(newMetadata);
  }, []);

  const toggleVideoInfo = useCallback(() => {
    setShowVideoInfo(prev => !prev);
  }, []);

  // 키보드 단축키 핸들러
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enableKeyboardShortcuts || !isFocused) return;
    
    // 입력 필드에서는 단축키 비활성화
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      return;
    }

    const { key, ctrlKey, metaKey, altKey, shiftKey } = event;
    
    switch (key.toLowerCase()) {
      case ' ':
      case 'k':
        // 스페이스바 또는 K: 재생/일시정지
        event.preventDefault();
        togglePlay();
        break;
        
      case 'arrowleft':
        // 왼쪽 화살표: 10초 뒤로
        event.preventDefault();
        if (shiftKey) {
          // Shift + 왼쪽: 5초 뒤로
          const newTime = Math.max(0, state.played * state.duration - 5);
          seekTo(newTime / state.duration);
        } else {
          const newTime = Math.max(0, state.played * state.duration - 10);
          seekTo(newTime / state.duration);
        }
        break;
        
      case 'arrowright':
        // 오른쪽 화살표: 10초 앞으로
        event.preventDefault();
        if (shiftKey) {
          // Shift + 오른쪽: 5초 앞으로
          const newTime = Math.min(state.duration, state.played * state.duration + 5);
          seekTo(newTime / state.duration);
        } else {
          const newTime = Math.min(state.duration, state.played * state.duration + 10);
          seekTo(newTime / state.duration);
        }
        break;
        
      case 'arrowup':
        // 위쪽 화살표: 볼륨 증가
        event.preventDefault();
        setVolume(state.volume + 0.1);
        break;
        
      case 'arrowdown':
        // 아래쪽 화살표: 볼륨 감소
        event.preventDefault();
        setVolume(state.volume - 0.1);
        break;
        
      case 'm':
        // M: 음소거 토글
        event.preventDefault();
        toggleMute();
        break;
        
      case 'f':
        // F: 전체화면 토글
        event.preventDefault();
        toggleFullscreen();
        break;
        
      case 'p':
        // P: Picture-in-Picture 토글
        event.preventDefault();
        togglePiP();
        break;
        
      case 'i':
        // I: 정보 패널 토글
        event.preventDefault();
        toggleVideoInfo();
        break;
        
      case '0':
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        // 숫자 키: 해당 위치로 점프 (0=시작, 1=10%, 2=20%, ...)
        event.preventDefault();
        const percentage = parseInt(key) / 10;
        seekTo(percentage);
        break;
        
      case ',':
        // 쉼표: 프레임 단위로 뒤로 (0.1초)
        event.preventDefault();
        const prevFrame = Math.max(0, state.played * state.duration - 0.1);
        seekTo(prevFrame / state.duration);
        break;
        
      case '.':
        // 마침표: 프레임 단위로 앞으로 (0.1초)
        event.preventDefault();
        const nextFrame = Math.min(state.duration, state.played * state.duration + 0.1);
        seekTo(nextFrame / state.duration);
        break;
        
      case '<':
        // <: 재생 속도 감소
        event.preventDefault();
        const slowerRate = Math.max(0.25, state.playbackRate - 0.25);
        setPlaybackRate(slowerRate);
        break;
        
      case '>':
        // >: 재생 속도 증가
        event.preventDefault();
        const fasterRate = Math.min(2, state.playbackRate + 0.25);
        setPlaybackRate(fasterRate);
        break;
        
      default:
        // 다른 키는 처리하지 않음
        break;
    }
  }, [enableKeyboardShortcuts, isFocused, state, togglePlay, seekTo, setVolume, toggleMute, toggleFullscreen, togglePiP, toggleVideoInfo, setPlaybackRate]);

  // 키보드 이벤트 리스너 등록
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboardShortcuts, handleKeyDown]);

  // 포커스 관리
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  const handleClick = useCallback(() => {
    if (containerRef.current && enableKeyboardShortcuts) {
      containerRef.current.focus();
    }
  }, [enableKeyboardShortcuts]);

  return (
    <div className={`flex gap-4 ${className}`}>
      {/* Video Player Container */}
      <div 
        ref={containerRef}
        className="relative bg-black rounded-lg overflow-hidden group flex-1 outline-none"
        tabIndex={enableKeyboardShortcuts ? 0 : -1}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={handleClick}
        role="application"
        aria-label="비디오 플레이어"
      >
        <ReactPlayer
          ref={playerRef}
          url={url}
          playing={state.playing}
          muted={state.muted}
          volume={state.volume}
          playbackRate={state.playbackRate}
          pip={state.pip}
          controls={state.controls}
          width="100%"
          height="100%"
          onPlay={handlePlay}
          onPause={handlePause}
          onProgress={handleProgress}
          onDuration={handleDuration}
          onEnded={handleEnded}
          onReady={handleReady}
          {...props}
        />
        
        {/* Custom VideoControls */}
        <VideoControls
          isPlaying={state.playing}
          isMuted={state.muted}
          volume={state.volume}
          playbackRate={state.playbackRate}
          played={state.played}
          loaded={state.loaded}
          duration={state.duration}
          seeking={state.seeking}
          pip={state.pip}
          pipSupported={pipSupported}
          onPlayPause={togglePlay}
          onMute={toggleMute}
          onVolumeChange={setVolume}
          onSeek={seekTo}
          onSeekStart={handleSeekStart}
          onSeekEnd={handleSeekEnd}
          onPlaybackRateChange={setPlaybackRate}
          onTogglePiP={togglePiP}
          onFullscreen={toggleFullscreen}
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          showControls={true}
        />

        {/* Info Toggle Button */}
        <button
          onClick={toggleVideoInfo}
          className="absolute top-4 right-4 bg-black/60 text-white p-2 rounded-full hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100"
          title={showVideoInfo ? '정보 숨기기 (I)' : '정보 보기 (I)'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
        </button>

        {/* 키보드 단축키 안내 (포커스 시 표시) */}
        {enableKeyboardShortcuts && isFocused && (
          <div className="absolute top-4 left-4 bg-black/80 text-white text-xs p-2 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="space-y-1">
              <div>스페이스/K: 재생/일시정지</div>
              <div>←/→: 10초 이동, Shift+←/→: 5초 이동</div>
              <div>↑/↓: 볼륨 조절, M: 음소거</div>
              <div>F: 전체화면, P: PiP, I: 정보</div>
              <div>0-9: 위치 점프, &lt;/&gt;: 속도 조절</div>
            </div>
          </div>
        )}
      </div>

      {/* Video Info Panel */}
      {showVideoInfo && (
        <div className="w-80 flex-shrink-0">
          <VideoInfo
            url={url}
            metadata={metadata}
            currentTime={state.played * state.duration}
            duration={state.duration}
            isPlaying={state.playing}
            onMetadataLoad={handleMetadataLoad}
            className="sticky top-4"
          />
        </div>
      )}
    </div>
  );
}

// Export player controls for use by parent components
export { type VideoPlayerState, type VideoPlayerProps };
export const useVideoPlayerControls = (playerRef: React.RefObject<ReactPlayer>) => {
  return {
    play: () => playerRef.current?.getInternalPlayer()?.play?.(),
    pause: () => playerRef.current?.getInternalPlayer()?.pause?.(),
    seekTo: (time: number) => playerRef.current?.seekTo(time),
    getCurrentTime: () => playerRef.current?.getCurrentTime() || 0,
    getDuration: () => playerRef.current?.getDuration() || 0,
    getSecondsLoaded: () => playerRef.current?.getSecondsLoaded() || 0,
  };
}; 