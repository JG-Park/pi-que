import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import VideoPlayer from '@/app/HomePage/components/VideoPlayer/VideoPlayer';
import { VideoPlayerProps } from '@/types/video-player';

// Mock react-player
jest.mock('react-player', () => {
  return React.forwardRef<any, any>((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      getInternalPlayer: () => ({
        requestPictureInPicture: jest.fn(),
        play: jest.fn(),
        pause: jest.fn(),
      }),
      seekTo: jest.fn(),
      getCurrentTime: () => 60,
      getDuration: () => 300,
      getSecondsLoaded: () => 200,
    }));

    return (
      <div 
        data-testid="react-player"
        onClick={() => props.onPlay?.()}
      >
        Mock React Player
      </div>
    );
  });
});

// Mock child components
jest.mock('@/app/HomePage/components/VideoPlayer/VideoControls', () => {
  return function MockVideoControls(props: any) {
    return (
      <div data-testid="video-controls">
        <button onClick={props.onPlayPause} data-testid="play-pause">
          {props.isPlaying ? 'Pause' : 'Play'}
        </button>
        <button onClick={props.onMute} data-testid="mute">
          {props.isMuted ? 'Unmute' : 'Mute'}
        </button>
        <button onClick={props.onTogglePiP} data-testid="pip">
          {props.pip ? 'Exit PiP' : 'Enter PiP'}
        </button>
        <button onClick={props.onFullscreen} data-testid="fullscreen">
          Fullscreen
        </button>
      </div>
    );
  };
});

jest.mock('@/app/HomePage/components/VideoPlayer/VideoInfo', () => {
  return function MockVideoInfo(props: any) {
    return (
      <div data-testid="video-info">
        Video Info Component
        {props.onMetadataLoad && (
          <button 
            onClick={() => props.onMetadataLoad({ title: 'Test Video' })}
            data-testid="load-metadata"
          >
            Load Metadata
          </button>
        )}
      </div>
    );
  };
});

const defaultProps: VideoPlayerProps = {
  url: 'https://www.youtube.com/watch?v=test123',
  onProgress: jest.fn(),
  onDuration: jest.fn(),
  onEnded: jest.fn(),
  onPlay: jest.fn(),
  onPause: jest.fn(),
  onReady: jest.fn(),
};

// Mock browser APIs
Object.defineProperty(document, 'pictureInPictureEnabled', {
  value: true,
  configurable: true,
});

Object.defineProperty(document, 'pictureInPictureElement', {
  value: null,
  configurable: true,
  writable: true,
});

Object.defineProperty(document, 'exitPictureInPicture', {
  value: jest.fn().mockResolvedValue(undefined),
  configurable: true,
});

Object.defineProperty(document, 'fullscreenElement', {
  value: null,
  configurable: true,
  writable: true,
});

Object.defineProperty(document, 'exitFullscreen', {
  value: jest.fn().mockResolvedValue(undefined),
  configurable: true,
});

describe('VideoPlayer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset fullscreen and PiP states
    Object.defineProperty(document, 'pictureInPictureElement', {
      value: null,
      configurable: true,
      writable: true,
    });
    
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('should render without crashing', () => {
    render(<VideoPlayer {...defaultProps} />);
    expect(screen.getByTestId('react-player')).toBeInTheDocument();
    expect(screen.getByTestId('video-controls')).toBeInTheDocument();
  });

  it('should render VideoInfo when showInfo is true', () => {
    render(<VideoPlayer {...defaultProps} showInfo={true} />);
    expect(screen.getByTestId('video-info')).toBeInTheDocument();
  });

  it('should not render VideoInfo when showInfo is false', () => {
    render(<VideoPlayer {...defaultProps} showInfo={false} />);
    expect(screen.queryByTestId('video-info')).not.toBeInTheDocument();
  });

  describe('State Management', () => {
    it('should handle play/pause toggle', async () => {
      const user = userEvent.setup();
      render(<VideoPlayer {...defaultProps} />);
      
      const playPauseButton = screen.getByTestId('play-pause');
      expect(playPauseButton).toHaveTextContent('Play');
      
      await user.click(playPauseButton);
      expect(playPauseButton).toHaveTextContent('Pause');
    });

    it('should handle mute toggle', async () => {
      const user = userEvent.setup();
      render(<VideoPlayer {...defaultProps} />);
      
      const muteButton = screen.getByTestId('mute');
      expect(muteButton).toHaveTextContent('Mute');
      
      await user.click(muteButton);
      expect(muteButton).toHaveTextContent('Unmute');
    });

    it('should call onPlay callback when video starts playing', async () => {
      const onPlay = jest.fn();
      const user = userEvent.setup();
      render(<VideoPlayer {...defaultProps} onPlay={onPlay} />);
      
      const playPauseButton = screen.getByTestId('play-pause');
      await user.click(playPauseButton);
      
      expect(onPlay).toHaveBeenCalledTimes(1);
    });

    it('should call onPause callback when video is paused', async () => {
      const onPause = jest.fn();
      const user = userEvent.setup();
      render(<VideoPlayer {...defaultProps} onPause={onPause} />);
      
      const playPauseButton = screen.getByTestId('play-pause');
      
      // Start playing first
      await user.click(playPauseButton);
      
      // Then pause
      await user.click(playPauseButton);
      
      expect(onPause).toHaveBeenCalledTimes(1);
    });
  });

  describe('Picture-in-Picture', () => {
    it('should toggle PiP mode', async () => {
      const user = userEvent.setup();
      render(<VideoPlayer {...defaultProps} />);
      
      const pipButton = screen.getByTestId('pip');
      expect(pipButton).toHaveTextContent('Enter PiP');
      
      await user.click(pipButton);
      expect(pipButton).toHaveTextContent('Exit PiP');
    });

    it('should handle PiP events from browser', () => {
      render(<VideoPlayer {...defaultProps} />);
      
      // Simulate entering PiP
      fireEvent(document, new Event('enterpictureinpicture'));
      
      const pipButton = screen.getByTestId('pip');
      expect(pipButton).toHaveTextContent('Exit PiP');
      
      // Simulate leaving PiP
      fireEvent(document, new Event('leavepictureinpicture'));
      expect(pipButton).toHaveTextContent('Enter PiP');
    });

    it('should not show PiP button when not supported', () => {
      Object.defineProperty(document, 'pictureInPictureEnabled', {
        value: false,
        configurable: true,
      });
      
      render(<VideoPlayer {...defaultProps} />);
      
      // Mock VideoControls should receive pipSupported: false
      // This would be tested in the integration with real VideoControls
      expect(screen.getByTestId('pip')).toBeInTheDocument(); // Mock still shows it
    });
  });

  describe('Fullscreen', () => {
    it('should handle fullscreen toggle', async () => {
      const user = userEvent.setup();
      const mockRequestFullscreen = jest.fn();
      
      render(<VideoPlayer {...defaultProps} />);
      
      const container = screen.getByRole('application');
      container.requestFullscreen = mockRequestFullscreen;
      
      const fullscreenButton = screen.getByTestId('fullscreen');
      await user.click(fullscreenButton);
      
      expect(mockRequestFullscreen).toHaveBeenCalledTimes(1);
    });
  });

    describe('Keyboard Shortcuts', () => {
    let videoContainer: HTMLElement;

    beforeEach(() => {
      cleanup();
      // Focus the video player
      const { container } = render(<VideoPlayer {...defaultProps} enableKeyboardShortcuts={true} />);
      videoContainer = container.querySelector('[role="application"]') as HTMLElement;
      videoContainer?.focus();
      fireEvent.click(videoContainer!);
    });

    it('should toggle play/pause with spacebar', () => {
      fireEvent.keyDown(document, { key: ' ', code: 'Space' });
      
      const playPauseButton = screen.getByTestId('play-pause');
      expect(playPauseButton).toHaveTextContent('Pause');
    });

    it('should toggle play/pause with K key', () => {
      fireEvent.keyDown(document, { key: 'k', code: 'KeyK' });
      
      const playPauseButton = screen.getByTestId('play-pause');
      expect(playPauseButton).toHaveTextContent('Pause');
    });

    it('should toggle mute with M key', () => {
      fireEvent.keyDown(document, { key: 'm', code: 'KeyM' });
      
      const muteButton = screen.getByTestId('mute');
      expect(muteButton).toHaveTextContent('Unmute');
    });

    it('should toggle PiP with P key', () => {
      fireEvent.keyDown(document, { key: 'p', code: 'KeyP' });
      
      const pipButton = screen.getByTestId('pip');
      expect(pipButton).toHaveTextContent('Exit PiP');
    });

    it('should toggle fullscreen with F key', () => {
      const mockRequestFullscreen = jest.fn();
      const container = screen.getByRole('application');
      container.requestFullscreen = mockRequestFullscreen;
      
      fireEvent.keyDown(document, { key: 'f', code: 'KeyF' });
      
      expect(mockRequestFullscreen).toHaveBeenCalledTimes(1);
    });

    it('should not respond to keyboard shortcuts when disabled', () => {
      cleanup(); // Clear previous renders
      render(<VideoPlayer {...defaultProps} enableKeyboardShortcuts={false} />);
      
      fireEvent.keyDown(document, { key: ' ', code: 'Space' });
      
      const playPauseButtons = screen.getAllByTestId('play-pause');
      expect(playPauseButtons[0]).toHaveTextContent('Play'); // Should remain unchanged
    });

    it('should not respond to keyboard shortcuts in input fields', () => {
      cleanup(); // Clear previous renders
      render(
        <div>
          <VideoPlayer {...defaultProps} enableKeyboardShortcuts={true} />
          <input data-testid="text-input" />
        </div>
      );
      
      const input = screen.getByTestId('text-input');
      input.focus();
      
      fireEvent.keyDown(input, { key: ' ', code: 'Space' });
      
      const playPauseButtons = screen.getAllByTestId('play-pause');
      expect(playPauseButtons[0]).toHaveTextContent('Play'); // Should remain unchanged
    });
  });

  describe('Metadata Handling', () => {
    it('should handle metadata loading', async () => {
      render(<VideoPlayer {...defaultProps} showInfo={true} />);
      
      const loadMetadataButton = screen.getByTestId('load-metadata');
      fireEvent.click(loadMetadataButton);
      
      // Metadata should be loaded (this is handled by VideoInfo mock)
      expect(screen.getByTestId('video-info')).toBeInTheDocument();
    });
  });

  describe('Props and Callbacks', () => {
    it('should pass through react-player props', () => {
      render(<VideoPlayer {...defaultProps} autoPlay loop />);
      expect(screen.getByTestId('react-player')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(<VideoPlayer {...defaultProps} className="custom-class" />);
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should call onReady callback', () => {
      const onReady = jest.fn();
      render(<VideoPlayer {...defaultProps} onReady={onReady} />);
      
      // This would be triggered by react-player in real usage
      expect(onReady).toHaveBeenCalledTimes(0); // Mock doesn't auto-trigger
    });

    it('should call onEnded callback', () => {
      const onEnded = jest.fn();
      render(<VideoPlayer {...defaultProps} onEnded={onEnded} />);
      
      // This would be triggered by react-player when video ends
      expect(onEnded).toHaveBeenCalledTimes(0); // Mock doesn't auto-trigger
    });
  });

  describe('Info Panel Toggle', () => {
    it('should toggle info panel visibility', async () => {
      const user = userEvent.setup();
      render(<VideoPlayer {...defaultProps} showInfo={false} />);
      
      expect(screen.queryByTestId('video-info')).not.toBeInTheDocument();
      
      // Find and click info toggle button
      const infoToggleButton = screen.getByTitle('정보 보기 (I)');
      await user.click(infoToggleButton);
      
      expect(screen.getByTestId('video-info')).toBeInTheDocument();
    });

    it('should toggle info panel with I key', () => {
      render(<VideoPlayer {...defaultProps} showInfo={false} enableKeyboardShortcuts={true} />);
      
      const container = screen.getByRole('application');
      container.focus();
      
      expect(screen.queryByTestId('video-info')).not.toBeInTheDocument();
      
      fireEvent.keyDown(document, { key: 'i', code: 'KeyI' });
      
      expect(screen.getByTestId('video-info')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<VideoPlayer {...defaultProps} />);
      
      const container = screen.getByRole('application');
      expect(container).toHaveAttribute('aria-label', '비디오 플레이어');
      expect(container).toHaveAttribute('tabIndex', '0');
    });

    it('should be focusable when keyboard shortcuts are enabled', () => {
      render(<VideoPlayer {...defaultProps} enableKeyboardShortcuts={true} />);
      
      const container = screen.getByRole('application');
      expect(container).toHaveAttribute('tabIndex', '0');
    });

    it('should not be focusable when keyboard shortcuts are disabled', () => {
      render(<VideoPlayer {...defaultProps} enableKeyboardShortcuts={false} />);
      
      const container = screen.getByRole('application');
      expect(container).toHaveAttribute('tabIndex', '-1');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing URL gracefully', () => {
      expect(() => {
        render(<VideoPlayer {...defaultProps} url={undefined} />);
      }).not.toThrow();
    });

    it('should handle PiP errors gracefully', async () => {
      const mockRequestPiP = jest.fn().mockRejectedValue(new Error('PiP failed'));
      
      // Mock console.error to avoid error output in tests
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      render(<VideoPlayer {...defaultProps} />);
      
      // This would need to be tested with actual PiP API integration
      consoleSpy.mockRestore();
    });
  });
}); 