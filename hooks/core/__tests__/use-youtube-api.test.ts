import { renderHook, act } from '@testing-library/react';
import { useYouTubeAPI } from '../use-youtube-api';

// Mock document methods
const mockCreateElement = jest.fn();
const mockAppendChild = jest.fn();

Object.defineProperty(document, 'createElement', {
  value: mockCreateElement,
  writable: true,
});

Object.defineProperty(document, 'head', {
  value: { appendChild: mockAppendChild },
  writable: true,
});

describe('useYouTubeAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete (window as any).YT;
    delete (window as any).onYouTubeIframeAPIReady;
    
    mockCreateElement.mockReturnValue({
      src: '',
      async: false,
      onerror: null,
      onload: null,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should return initial state correctly', () => {
      const { result } = renderHook(() => useYouTubeAPI());

      expect(result.current.isReady).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.retryLoad).toBe('function');
    });
  });

  describe('API loading', () => {
    it('should start loading API when hook is initialized', () => {
      const { result } = renderHook(() => useYouTubeAPI());

      // Should attempt to create script element
      expect(mockCreateElement).toHaveBeenCalledWith('script');
    });

    it('should handle API already being loaded', () => {
      // Mock YT API as already loaded
      (window as any).YT = {
        Player: jest.fn(),
      };

      const { result } = renderHook(() => useYouTubeAPI());

      expect(result.current.isReady).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle retry functionality', () => {
      const { result } = renderHook(() => useYouTubeAPI());

      act(() => {
        result.current.retryLoad();
      });

      // Should attempt to create script again
      expect(mockCreateElement).toHaveBeenCalledTimes(2);
    });
  });

  describe('cleanup', () => {
    it('should not throw on unmount', () => {
      const { unmount } = renderHook(() => useYouTubeAPI());
      expect(() => unmount()).not.toThrow();
    });
  });
}); 