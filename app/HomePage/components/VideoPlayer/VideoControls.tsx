'use client';

import React, { memo, useState, useRef, useEffect } from 'react';
import { 
  FaPlay, 
  FaPause, 
  FaVolumeUp, 
  FaVolumeDown, 
  FaVolumeMute,
  FaExpand,
  FaCompress,
  FaStepBackward,
  FaStepForward
} from 'react-icons/fa';
import { MdPictureInPictureAlt } from 'react-icons/md';
import { VideoControlsProps } from '@/types/video-player';
import { formatDuration } from '../../../../utils/time/formatDuration';

const VideoControls = memo(function VideoControls({
  isPlaying,
  isMuted,
  volume,
  playbackRate,
  played,
  loaded,
  duration,
  seeking,
  pip,
  pipSupported = true,
  onPlayPause,
  onMute,
  onVolumeChange,
  onSeek,
  onSeekStart,
  onSeekEnd,
  onPlaybackRateChange,
  onTogglePiP,
  onFullscreen,
  className = '',
  showControls = true,
}: VideoControlsProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [localVolume, setLocalVolume] = useState(volume);
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalVolume(volume);
  }, [volume]);

  // Fullscreen 상태 감지
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    onSeek(Math.max(0, Math.min(1, percentage)));
  };

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    onSeekStart();
    handleProgressClick(e);
  };

  const handleProgressMouseMove = (e: MouseEvent) => {
    if (!isDragging || !progressRef.current) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    onSeek(Math.max(0, Math.min(1, percentage)));
  };

  const handleProgressMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      onSeekEnd();
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setLocalVolume(newVolume);
    onVolumeChange(newVolume);
  };

  const handleVolumeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!volumeRef.current) return;
    
    const rect = volumeRef.current.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const percentage = 1 - (clickY / rect.height);
    const newVolume = Math.max(0, Math.min(1, percentage));
    setLocalVolume(newVolume);
    onVolumeChange(newVolume);
  };

  const handleSkip = (seconds: number) => {
    const currentTime = played * duration;
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    onSeek(newTime / duration);
  };

  const getVolumeIcon = () => {
    if (isMuted || localVolume === 0) return FaVolumeMute;
    if (localVolume < 0.5) return FaVolumeDown;
    return FaVolumeUp;
  };

  const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2];

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleProgressMouseMove);
      document.addEventListener('mouseup', handleProgressMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleProgressMouseMove);
        document.removeEventListener('mouseup', handleProgressMouseUp);
      };
    }
  }, [isDragging]);

  if (!showControls) return null;

  return (
    <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 ${className}`}>
      {/* Progress Bar */}
      <div className="mb-4">
        <div
          ref={progressRef}
          className="relative h-2 bg-white/30 rounded-full cursor-pointer hover:h-3 transition-all"
          onClick={handleProgressClick}
          onMouseDown={handleProgressMouseDown}
        >
          {/* Loaded Progress */}
          <div
            className="absolute top-0 left-0 h-full bg-white/50 rounded-full"
            style={{ width: `${loaded * 100}%` }}
          />
          
          {/* Played Progress */}
          <div
            className="absolute top-0 left-0 h-full bg-white rounded-full"
            style={{ width: `${played * 100}%` }}
          />
          
          {/* Progress Handle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 hover:opacity-100 transition-opacity"
            style={{ left: `${played * 100}%`, transform: 'translate(-50%, -50%)' }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between text-white">
        {/* Left Controls */}
        <div className="flex items-center space-x-4">
          {/* Skip Backward */}
          <button
            onClick={() => handleSkip(-10)}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
            title="10초 뒤로"
          >
            <FaStepBackward size={16} />
          </button>

          {/* Play/Pause */}
          <button
            onClick={onPlayPause}
            className="p-3 hover:bg-white/20 rounded-full transition-colors"
            title={isPlaying ? '일시정지' : '재생'}
          >
            {isPlaying ? <FaPause size={20} /> : <FaPlay size={20} />}
          </button>

          {/* Skip Forward */}
          <button
            onClick={() => handleSkip(10)}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
            title="10초 앞으로"
          >
            <FaStepForward size={16} />
          </button>

          {/* Volume Controls */}
          <div 
            className="relative flex items-center"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <button
              onClick={onMute}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              title={isMuted ? '음소거 해제' : '음소거'}
            >
              {React.createElement(getVolumeIcon(), { size: 16 })}
            </button>

            {/* Volume Slider */}
            {showVolumeSlider && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-black/80 rounded">
                <div
                  ref={volumeRef}
                  className="w-4 h-20 bg-white/30 rounded-full cursor-pointer relative"
                  onClick={handleVolumeClick}
                >
                  <div
                    className="absolute bottom-0 left-0 w-full bg-white rounded-full"
                    style={{ height: `${localVolume * 100}%` }}
                  />
                  <div
                    className="absolute w-4 h-4 bg-white rounded-full shadow-lg -translate-x-0"
                    style={{ bottom: `${localVolume * 100}%`, transform: 'translateY(50%)' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Time Display */}
          <div className="text-sm">
            <span>{formatDuration(played * duration)}</span>
            <span className="mx-1">/</span>
            <span>{formatDuration(duration)}</span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center space-x-4">
          {/* Playback Rate */}
          <select
            value={playbackRate}
            onChange={(e) => onPlaybackRateChange(parseFloat(e.target.value))}
            className="bg-transparent border border-white/30 rounded px-2 py-1 text-sm hover:bg-white/10 transition-colors"
            title="재생 속도"
          >
            {playbackRates.map(rate => (
              <option key={rate} value={rate} className="bg-black">
                {rate}x
              </option>
            ))}
          </select>

          {/* Picture in Picture */}
          {pipSupported && (
            <button
              onClick={onTogglePiP}
              className={`p-2 hover:bg-white/20 rounded-full transition-colors ${pip ? 'text-blue-400' : ''}`}
              title={pip ? "PiP 모드 종료" : "화면 속 화면"}
            >
              <MdPictureInPictureAlt size={18} />
            </button>
          )}

          {/* PiP Not Supported Message (for debugging) */}
          {!pipSupported && process.env.NODE_ENV === 'development' && (
            <div 
              className="p-2 text-xs text-white/60 rounded" 
              title="이 브라우저는 Picture-in-Picture를 지원하지 않습니다"
            >
              PiP 미지원
            </div>
          )}

          {/* Fullscreen */}
          {onFullscreen && (
            <button
              onClick={onFullscreen}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              title={isFullscreen ? '전체화면 해제' : '전체화면'}
            >
              {isFullscreen ? <FaCompress size={16} /> : <FaExpand size={16} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default VideoControls; 