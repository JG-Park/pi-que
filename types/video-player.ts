// Types for VideoPlayer component
export interface OnProgressProps {
  played: number;
  playedSeconds: number;
  loaded: number;
  loadedSeconds: number;
}

export interface VideoPlayerState {
  playing: boolean;
  muted: boolean;
  volume: number;
  playbackRate: number;
  played: number;
  loaded: number;
  duration: number;
  seeking: boolean;
  pip: boolean;
  controls: boolean;
}

export interface VideoPlayerProps {
  url?: string;
  className?: string;
  onProgress?: (progress: OnProgressProps) => void;
  onDuration?: (duration: number) => void;
  onEnded?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onReady?: () => void;
  // Additional react-player props can be passed through
  [key: string]: any;
}

export interface VideoPlayerControls {
  play: () => void;
  pause: () => void;
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getSecondsLoaded: () => number;
}

// VideoControls component types
export interface VideoControlsProps {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  playbackRate: number;
  played: number;
  loaded: number;
  duration: number;
  seeking: boolean;
  pip: boolean;
  pipSupported?: boolean;
  onPlayPause: () => void;
  onMute: () => void;
  onVolumeChange: (volume: number) => void;
  onSeek: (played: number) => void;
  onSeekStart: () => void;
  onSeekEnd: () => void;
  onPlaybackRateChange: (rate: number) => void;
  onTogglePiP: () => void;
  onFullscreen?: () => void;
  className?: string;
  showControls?: boolean;
}

// VideoInfo component types
export interface VideoMetadata {
  title?: string;
  description?: string;
  channel?: string;
  uploadDate?: string;
  viewCount?: number;
  duration?: number;
  thumbnail?: string;
  tags?: string[];
  quality?: string;
}

export interface VideoInfoProps {
  url?: string;
  metadata?: VideoMetadata;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isLoading?: boolean;
  className?: string;
  showMetadata?: boolean;
  onMetadataLoad?: (metadata: VideoMetadata) => void;
} 