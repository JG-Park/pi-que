import axios from 'axios';
import { YouTubeAPIServiceImpl, createYouTubeAPIService } from '../youtube-api.service';
import { ValidationError, QuotaExceededError, NotFoundError, YouTubeSearchQuery } from '@/types/services';
import type { YouTubeVideoInfo } from '@/types/youtube';

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    interceptors: {
      request: {
        use: jest.fn()
      },
      response: {
        use: jest.fn()
      }
    }
  })),
  get: jest.fn(),
  isAxiosError: jest.fn((error) => error && error.response)
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock console methods to avoid noise in tests
const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

describe('YouTubeAPIService', () => {
  let service: YouTubeAPIServiceImpl;
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new YouTubeAPIServiceImpl(mockApiKey);
    
    // Reset quota tracking
    (service as any).quotaUsed = 0;
    (service as any).quotaResetDate = new Date().toDateString();
    (service as any).cache.clear();
  });

  afterAll(() => {
    consoleSpy.mockRestore();
  });

  describe('Constructor and Factory', () => {
    it('should create service with API key', () => {
      expect(service).toBeInstanceOf(YouTubeAPIServiceImpl);
      expect((service as any).apiKey).toBe(mockApiKey);
    });

    it('should create service with factory function', () => {
      const factoryService = createYouTubeAPIService(mockApiKey);
      expect(factoryService).toBeInstanceOf(YouTubeAPIServiceImpl);
    });

    it('should throw error if no API key provided to factory', () => {
      // Mock environment variable as undefined
      const originalEnv = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
      delete process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

      expect(() => createYouTubeAPIService()).toThrow('YouTube API key is required');

      // Restore environment variable
      if (originalEnv) {
        process.env.NEXT_PUBLIC_YOUTUBE_API_KEY = originalEnv;
      }
    });
  });

  describe('searchVideos', () => {
    const mockSearchResponse = {
      data: {
        items: [
          {
            id: { videoId: 'test-video-1' },
            snippet: {
              title: 'Test Video 1',
              description: 'Test description 1',
              thumbnails: {
                medium: { url: 'https://example.com/thumb1.jpg' }
              },
              channelTitle: 'Test Channel 1',
              publishedAt: '2023-01-01T00:00:00Z'
            },
            contentDetails: {
              duration: 'PT4M13S'
            },
            statistics: {
              viewCount: '1000',
              likeCount: '100'
            }
          }
        ],
        nextPageToken: 'next-token',
        pageInfo: {
          totalResults: 100,
          resultsPerPage: 10
        }
      }
    };

    it('should search videos successfully', async () => {
      mockedAxios.get.mockResolvedValueOnce(mockSearchResponse);

      const query: YouTubeSearchQuery = {
        q: 'test query',
        order: 'relevance',
        type: 'video'
      };

      const result = await service.searchVideos(query);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        id: 'test-video-1',
        title: 'Test Video 1',
        description: 'Test description 1',
        duration: 253, // 4m 13s in seconds
        channelTitle: 'Test Channel 1'
      });
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.totalItems).toBe(100);
    });

    it('should validate search query', async () => {
      const invalidQuery = { q: '', order: 'relevance', type: 'video' } as YouTubeSearchQuery;

      await expect(service.searchVideos(invalidQuery)).rejects.toThrow(ValidationError);
    });

    it('should handle quota exceeded error', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        response: {
          status: 403,
          data: {
            error: {
              errors: [{ reason: 'quotaExceeded' }]
            }
          }
        }
      });

      const query: YouTubeSearchQuery = {
        q: 'test query',
        order: 'relevance',
        type: 'video'
      };

      await expect(service.searchVideos(query)).rejects.toThrow(QuotaExceededError);
    });

    it('should use cache for repeated requests', async () => {
      mockedAxios.get.mockResolvedValueOnce(mockSearchResponse);

      const query: YouTubeSearchQuery = {
        q: 'test query',
        order: 'relevance',
        type: 'video'
      };

      // First request
      await service.searchVideos(query);
      
      // Second request (should use cache)
      await service.searchVideos(query);

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getVideoDetails', () => {
    const mockVideoResponse = {
      data: {
        items: [
          {
            id: 'test-video-1',
            snippet: {
              title: 'Test Video 1',
              description: 'Test description 1',
              thumbnails: {
                medium: { url: 'https://example.com/thumb1.jpg' }
              },
              channelTitle: 'Test Channel 1',
              publishedAt: '2023-01-01T00:00:00Z'
            },
            contentDetails: {
              duration: 'PT4M13S'
            },
            statistics: {
              viewCount: '1000',
              likeCount: '100'
            }
          }
        ]
      }
    };

    it('should get video details successfully', async () => {
      mockedAxios.get.mockResolvedValueOnce(mockVideoResponse);

      const result = await service.getVideoDetails('test-video-1');

      expect(result).toMatchObject({
        id: 'test-video-1',
        title: 'Test Video 1',
        description: 'Test description 1',
        duration: 253,
        channelTitle: 'Test Channel 1'
      });
    });

    it('should validate video ID', async () => {
      await expect(service.getVideoDetails('')).rejects.toThrow(ValidationError);
    });

    it('should handle video not found', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { items: [] }
      });

      await expect(service.getVideoDetails('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getMultipleVideoDetails', () => {
    it('should get multiple video details', async () => {
      const mockResponse = {
        data: {
          items: [
            {
              id: 'video1',
              snippet: {
                title: 'Video 1',
                description: 'Description 1',
                thumbnails: { medium: { url: 'thumb1.jpg' } },
                channelTitle: 'Channel 1',
                publishedAt: '2023-01-01T00:00:00Z'
              },
              contentDetails: { duration: 'PT1M' },
              statistics: { viewCount: '100', likeCount: '10' }
            },
            {
              id: 'video2',
              snippet: {
                title: 'Video 2',
                description: 'Description 2',
                thumbnails: { medium: { url: 'thumb2.jpg' } },
                channelTitle: 'Channel 2',
                publishedAt: '2023-01-02T00:00:00Z'
              },
              contentDetails: { duration: 'PT2M' },
              statistics: { viewCount: '200', likeCount: '20' }
            }
          ]
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const result = await service.getMultipleVideoDetails(['video1', 'video2']);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('video1');
      expect(result[1].id).toBe('video2');
    });

    it('should validate video IDs array', async () => {
      await expect(service.getMultipleVideoDetails([])).rejects.toThrow(ValidationError);
    });

    it('should handle too many video IDs', async () => {
      const tooManyIds = Array.from({ length: 51 }, (_, i) => `video${i}`);
      await expect(service.getMultipleVideoDetails(tooManyIds)).rejects.toThrow(ValidationError);
    });
  });

  describe('extractVideoId', () => {
    it('should extract video ID from watch URL', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      expect(service.extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from youtu.be URL', () => {
      const url = 'https://youtu.be/dQw4w9WgXcQ';
      expect(service.extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from embed URL', () => {
      const url = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
      expect(service.extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from shorts URL', () => {
      const url = 'https://www.youtube.com/shorts/dQw4w9WgXcQ';
      expect(service.extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    it('should return null for invalid URL', () => {
      expect(service.extractVideoId('https://example.com')).toBeNull();
    });
  });

  describe('validateVideoUrl', () => {
    it('should validate correct YouTube URLs', () => {
      const validUrls = [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtu.be/dQw4w9WgXcQ',
        'https://www.youtube.com/embed/dQw4w9WgXcQ',
        'https://www.youtube.com/shorts/dQw4w9WgXcQ'
      ];

      validUrls.forEach(url => {
        expect(service.validateVideoUrl(url)).toBe(true);
      });
    });

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        'https://example.com',
        'not-a-url',
        'https://vimeo.com/123456',
        ''
      ];

      invalidUrls.forEach(url => {
        expect(service.validateVideoUrl(url)).toBe(false);
      });
    });
  });

  describe('getQuotaUsage', () => {
    it('should return current quota usage', async () => {
      const usage = await service.getQuotaUsage();
      
      expect(usage).toMatchObject({
        used: expect.any(Number),
        limit: expect.any(Number),
        remaining: expect.any(Number),
        resetTime: expect.any(Date)
      });
    });

    it('should reset quota on new day', async () => {
      // Set quota to yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      (service as any).quotaResetDate = yesterday.toDateString();
      (service as any).quotaUsed = 1000;

      const usage = await service.getQuotaUsage();
      
      expect(usage.used).toBe(0);
      expect(usage.resetTime.toDateString()).toBe(new Date().toDateString());
    });
  });

  describe('isHealthy', () => {
    it('should return true when service is healthy', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { items: [] }
      });

      const isHealthy = await service.isHealthy();
      expect(isHealthy).toBe(true);
    });

    it('should return false when service is unhealthy', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      const isHealthy = await service.isHealthy();
      expect(isHealthy).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network Error'));

      const query: YouTubeSearchQuery = {
        q: 'test query',
        order: 'relevance',
        type: 'video'
      };

      await expect(service.searchVideos(query)).rejects.toThrow('Network Error');
    });

    it('should handle API errors with proper error types', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        response: {
          status: 400,
          data: {
            error: {
              message: 'Bad Request'
            }
          }
        }
      });

      const query: YouTubeSearchQuery = {
        q: 'test query',
        order: 'relevance',
        type: 'video'
      };

      await expect(service.searchVideos(query)).rejects.toThrow();
    });
  });

  describe('Duration Parsing', () => {
    it('should parse ISO 8601 duration correctly', () => {
      const testCases = [
        { input: 'PT4M13S', expected: 253 },
        { input: 'PT1H2M3S', expected: 3723 },
        { input: 'PT30S', expected: 30 },
        { input: 'PT5M', expected: 300 },
        { input: 'PT2H', expected: 7200 },
        { input: 'PT0S', expected: 0 }
      ];

      testCases.forEach(({ input, expected }) => {
        const parsed = (service as any).parseDuration(input);
        expect(parsed).toBe(expected);
      });
    });

    it('should handle invalid duration format', () => {
      const invalidDurations = ['invalid', '', 'PT', 'P1D'];
      
      invalidDurations.forEach(duration => {
        const parsed = (service as any).parseDuration(duration);
        expect(parsed).toBe(0);
      });
    });
  });
}); 