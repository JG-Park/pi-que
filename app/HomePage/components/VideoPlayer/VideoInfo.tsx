'use client';

import React, { memo, useEffect, useState } from 'react';
import { FaPlay, FaPause, FaClock, FaEye, FaCalendarAlt, FaUser } from 'react-icons/fa';
import { VideoInfoProps, VideoMetadata } from '@/types/video-player';
import { formatDuration } from '../../../../utils/time/formatDuration';

const VideoInfo = memo(function VideoInfo({
  url,
  metadata,
  currentTime,
  duration,
  isPlaying,
  isLoading = false,
  className = '',
  showMetadata = true,
  onMetadataLoad,
}: VideoInfoProps) {
  const [loadedMetadata, setLoadedMetadata] = useState<VideoMetadata | null>(metadata || null);
  const [isExpanded, setIsExpanded] = useState(false);

  // URL에서 비디오 메타데이터 추출 시도
  useEffect(() => {
    if (!url || loadedMetadata) return;

    const extractMetadataFromUrl = async () => {
      try {
        let extractedMetadata: VideoMetadata = {};

        // YouTube URL 처리
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
          const videoId = extractYouTubeId(url);
          if (videoId) {
            extractedMetadata = {
              title: `YouTube Video ${videoId}`,
              channel: 'YouTube',
              quality: 'HD',
            };
          }
        }
        
        // Vimeo URL 처리
        else if (url.includes('vimeo.com')) {
          const videoId = extractVimeoId(url);
          if (videoId) {
            extractedMetadata = {
              title: `Vimeo Video ${videoId}`,
              channel: 'Vimeo',
              quality: 'HD',
            };
          }
        }
        
        // 일반 비디오 파일 처리
        else {
          const fileName = url.split('/').pop()?.split('?')[0] || 'Video';
          extractedMetadata = {
            title: fileName,
            quality: 'Unknown',
          };
        }

        setLoadedMetadata(extractedMetadata);
        onMetadataLoad?.(extractedMetadata);
      } catch (error) {
        console.error('Failed to extract metadata:', error);
      }
    };

    extractMetadataFromUrl();
  }, [url, loadedMetadata, onMetadataLoad]);

  const extractYouTubeId = (url: string): string | null => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const extractVimeoId = (url: string): string | null => {
    const regex = /vimeo\.com\/(\d+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const formatViewCount = (count?: number): string => {
    if (!count) return '0';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const formatUploadDate = (dateString?: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (isLoading) {
    return (
      <div className={`bg-black/80 backdrop-blur-sm rounded-lg p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-600 rounded mb-2"></div>
          <div className="h-3 bg-gray-600 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-600 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-black/80 backdrop-blur-sm rounded-lg p-4 text-white ${className}`}>
      {/* 기본 재생 정보 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            {isPlaying ? (
              <FaPlay className="text-green-400" size={12} />
            ) : (
              <FaPause className="text-gray-400" size={12} />
            )}
            <span className="text-sm text-gray-300">
              {isPlaying ? '재생 중' : '일시정지'}
            </span>
          </div>
          
          <div className="text-sm text-gray-300">
            <FaClock className="inline mr-1" size={12} />
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </div>
        </div>

        <div className="text-sm text-gray-300">
          {progressPercentage.toFixed(1)}%
        </div>
      </div>

      {/* 진행률 바 */}
      <div className="w-full h-1 bg-gray-600 rounded-full mb-4">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-200"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* 메타데이터 표시 */}
      {showMetadata && loadedMetadata && (
        <div className="space-y-3">
          {/* 제목 */}
          {loadedMetadata.title && (
            <div>
              <h3 className="text-lg font-semibold text-white line-clamp-2">
                {loadedMetadata.title}
              </h3>
            </div>
          )}

          {/* 채널 및 기본 정보 */}
          <div className="flex items-center justify-between text-sm text-gray-300">
            {loadedMetadata.channel && (
              <div className="flex items-center space-x-1">
                <FaUser size={12} />
                <span>{loadedMetadata.channel}</span>
              </div>
            )}

            {loadedMetadata.quality && (
              <div className="px-2 py-1 bg-gray-700 rounded text-xs">
                {loadedMetadata.quality}
              </div>
            )}
          </div>

          {/* 상세 정보 (접을 수 있음) */}
          {(loadedMetadata.viewCount || loadedMetadata.uploadDate || loadedMetadata.description) && (
            <div>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                {isExpanded ? '접기' : '자세히 보기'}
              </button>

              {isExpanded && (
                <div className="mt-3 space-y-2 text-sm text-gray-300">
                  {/* 조회수 및 업로드 날짜 */}
                  <div className="flex items-center space-x-4">
                    {loadedMetadata.viewCount && (
                      <div className="flex items-center space-x-1">
                        <FaEye size={12} />
                        <span>조회수 {formatViewCount(loadedMetadata.viewCount)}회</span>
                      </div>
                    )}

                    {loadedMetadata.uploadDate && (
                      <div className="flex items-center space-x-1">
                        <FaCalendarAlt size={12} />
                        <span>{formatUploadDate(loadedMetadata.uploadDate)}</span>
                      </div>
                    )}
                  </div>

                  {/* 설명 */}
                  {loadedMetadata.description && (
                    <div>
                      <p className="text-gray-400 line-clamp-3">
                        {loadedMetadata.description}
                      </p>
                    </div>
                  )}

                  {/* 태그 */}
                  {loadedMetadata.tags && loadedMetadata.tags.length > 0 && (
                    <div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {loadedMetadata.tags.slice(0, 5).map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-gray-700 rounded-full text-xs"
                          >
                            #{tag}
                          </span>
                        ))}
                        {loadedMetadata.tags.length > 5 && (
                          <span className="px-2 py-1 bg-gray-700 rounded-full text-xs">
                            +{loadedMetadata.tags.length - 5}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default VideoInfo; 