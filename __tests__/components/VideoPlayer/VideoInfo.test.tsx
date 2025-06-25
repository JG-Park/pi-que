import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import VideoInfo from '@/app/HomePage/components/VideoPlayer/VideoInfo';
import { VideoInfoProps, VideoMetadata } from '@/types/video-player';

// Mock the formatDuration utility
jest.mock('@/utils/time/formatDuration', () => ({
  formatDuration: (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  },
}));

const defaultMetadata: VideoMetadata = {
  title: '테스트 비디오',
  description: '이것은 테스트 비디오 설명입니다.',
  channel: '테스트 채널',
  uploadDate: '2024-01-01',
  viewCount: 1500000,
  duration: 300,
  thumbnail: 'https://example.com/thumbnail.jpg',
  tags: ['테스트', '비디오', 'React'],
  quality: '1080p',
};

const defaultProps: VideoInfoProps = {
  url: 'https://www.youtube.com/watch?v=test123',
  metadata: defaultMetadata,
  currentTime: 60,
  duration: 300,
  isPlaying: true,
  isLoading: false,
  onMetadataLoad: jest.fn(),
  showMetadata: true,
};

describe('VideoInfo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render without crashing', () => {
    render(<VideoInfo {...defaultProps} />);
    expect(screen.getByText('재생 중')).toBeInTheDocument();
  });

  describe('Playback Status', () => {
    it('should show "재생 중" when playing', () => {
      render(<VideoInfo {...defaultProps} isPlaying={true} />);
      expect(screen.getByText('재생 중')).toBeInTheDocument();
    });

    it('should show "일시정지" when paused', () => {
      render(<VideoInfo {...defaultProps} isPlaying={false} />);
      expect(screen.getByText('일시정지')).toBeInTheDocument();
    });

    it('should display current time and duration', () => {
      render(<VideoInfo {...defaultProps} currentTime={60} duration={300} />);
      expect(screen.getByText('1:00 / 5:00')).toBeInTheDocument();
    });

    it('should calculate and display progress percentage', () => {
      render(<VideoInfo {...defaultProps} currentTime={60} duration={300} />);
      expect(screen.getByText('20%')).toBeInTheDocument();
    });
  });

  describe('Progress Bar', () => {
    it('should display progress bar with correct width', () => {
      render(<VideoInfo {...defaultProps} currentTime={60} duration={300} />);
      
      // Check if progress bar exists
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
    });

    it('should handle zero duration gracefully', () => {
      render(<VideoInfo {...defaultProps} currentTime={60} duration={0} />);
      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });

  describe('Metadata Display', () => {
    it('should display video title when metadata is provided', () => {
      render(<VideoInfo {...defaultProps} />);
      expect(screen.getByText('테스트 비디오')).toBeInTheDocument();
    });

    it('should display channel name when available', () => {
      render(<VideoInfo {...defaultProps} />);
      expect(screen.getByText('테스트 채널')).toBeInTheDocument();
    });

    it('should display video quality when available', () => {
      render(<VideoInfo {...defaultProps} />);
      expect(screen.getByText('1080p')).toBeInTheDocument();
    });

    it('should not show metadata when showMetadata is false', () => {
      render(<VideoInfo {...defaultProps} showMetadata={false} />);
      expect(screen.queryByText('테스트 비디오')).not.toBeInTheDocument();
    });

    it('should show loading state when isLoading is true', () => {
      render(<VideoInfo {...defaultProps} isLoading={true} />);
      expect(screen.getByText('로딩 중...')).toBeInTheDocument();
    });
  });

  describe('Detailed Information Toggle', () => {
    it('should toggle detailed information when button is clicked', async () => {
      const user = userEvent.setup();
      render(<VideoInfo {...defaultProps} />);
      
      const toggleButton = screen.getByText('자세히');
      await user.click(toggleButton);
      
      // Should show detailed information
      expect(screen.getByText('1.5M')).toBeInTheDocument(); // Formatted view count
      expect(screen.getByText('2024. 1. 1.')).toBeInTheDocument(); // Formatted date
    });

    it('should hide detailed information when toggle button is clicked again', async () => {
      const user = userEvent.setup();
      render(<VideoInfo {...defaultProps} />);
      
      const toggleButton = screen.getByText('자세히');
      
      // Click to show
      await user.click(toggleButton);
      expect(screen.getByText('1.5M')).toBeInTheDocument();
      
      // Click to hide
      const hideButton = screen.getByText('간단히');
      await user.click(hideButton);
      expect(screen.queryByText('1.5M')).not.toBeInTheDocument();
    });
  });

  describe('URL-based Metadata Extraction', () => {
    it('should extract metadata from YouTube URL', async () => {
      const onMetadataLoad = jest.fn();
      render(
        <VideoInfo 
          {...defaultProps} 
          url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
          metadata={undefined}
          onMetadataLoad={onMetadataLoad}
        />
      );
      
      await waitFor(() => {
        expect(onMetadataLoad).toHaveBeenCalled();
      });
    });

    it('should extract metadata from Vimeo URL', async () => {
      const onMetadataLoad = jest.fn();
      render(
        <VideoInfo 
          {...defaultProps} 
          url="https://vimeo.com/123456789"
          metadata={undefined}
          onMetadataLoad={onMetadataLoad}
        />
      );
      
      await waitFor(() => {
        expect(onMetadataLoad).toHaveBeenCalled();
      });
    });

    it('should handle generic file URLs', async () => {
      const onMetadataLoad = jest.fn();
      render(
        <VideoInfo 
          {...defaultProps} 
          url="https://example.com/video.mp4"
          metadata={undefined}
          onMetadataLoad={onMetadataLoad}
        />
      );
      
      await waitFor(() => {
        expect(onMetadataLoad).toHaveBeenCalled();
      });
    });
  });

  describe('Number Formatting', () => {
    it('should format view count correctly', () => {
      const metadataWithLargeViewCount: VideoMetadata = {
        ...defaultMetadata,
        viewCount: 1500000, // 1.5M
      };
      
      render(<VideoInfo {...defaultProps} metadata={metadataWithLargeViewCount} />);
      
      const toggleButton = screen.getByText('자세히');
      fireEvent.click(toggleButton);
      
      expect(screen.getByText('1.5M')).toBeInTheDocument();
    });

    it('should format smaller view counts with K', () => {
      const metadataWithSmallViewCount: VideoMetadata = {
        ...defaultMetadata,
        viewCount: 5500, // 5.5K
      };
      
      render(<VideoInfo {...defaultProps} metadata={metadataWithSmallViewCount} />);
      
      const toggleButton = screen.getByText('자세히');
      fireEvent.click(toggleButton);
      
      expect(screen.getByText('5.5K')).toBeInTheDocument();
    });

    it('should show actual number for counts under 1000', () => {
      const metadataWithTinyViewCount: VideoMetadata = {
        ...defaultMetadata,
        viewCount: 999,
      };
      
      render(<VideoInfo {...defaultProps} metadata={metadataWithTinyViewCount} />);
      
      const toggleButton = screen.getByText('자세히');
      fireEvent.click(toggleButton);
      
      expect(screen.getByText('999')).toBeInTheDocument();
    });
  });

  describe('Tags Display', () => {
    it('should display tags when available', () => {
      render(<VideoInfo {...defaultProps} />);
      
      const toggleButton = screen.getByText('자세히');
      fireEvent.click(toggleButton);
      
      expect(screen.getByText('테스트')).toBeInTheDocument();
      expect(screen.getByText('비디오')).toBeInTheDocument();
      expect(screen.getByText('React')).toBeInTheDocument();
    });

    it('should handle empty tags array', () => {
      const metadataWithoutTags: VideoMetadata = {
        ...defaultMetadata,
        tags: [],
      };
      
      render(<VideoInfo {...defaultProps} metadata={metadataWithoutTags} />);
      
      const toggleButton = screen.getByText('자세히');
      fireEvent.click(toggleButton);
      
      expect(screen.queryByText('태그:')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing metadata gracefully', () => {
      render(<VideoInfo {...defaultProps} metadata={undefined} />);
      expect(screen.getByText('재생 중')).toBeInTheDocument();
      expect(screen.queryByText('자세히')).not.toBeInTheDocument();
    });

    it('should handle invalid currentTime or duration', () => {
      render(<VideoInfo {...defaultProps} currentTime={NaN} duration={NaN} />);
      expect(screen.getByText('0:00 / 0:00')).toBeInTheDocument();
      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<VideoInfo {...defaultProps} />);
      
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      expect(progressBar).toHaveAttribute('aria-valuenow', '20'); // 60/300 * 100
    });

    it('should have proper heading structure', () => {
      render(<VideoInfo {...defaultProps} />);
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('비디오 정보');
    });
  });

  describe('Component Props', () => {
    it('should apply custom className', () => {
      const { container } = render(<VideoInfo {...defaultProps} className="custom-class" />);
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should handle undefined onMetadataLoad gracefully', () => {
      expect(() => {
        render(<VideoInfo {...defaultProps} onMetadataLoad={undefined} />);
      }).not.toThrow();
    });
  });
}); 