import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '/';
  },
}));

// Create a new QueryClient for each test to ensure isolation
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

// Custom render function that includes providers
interface AllTheProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

const AllTheProviders = ({ children, queryClient }: AllTheProvidersProps) => {
  const client = queryClient || createTestQueryClient();

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider attribute="class" defaultTheme="light">
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
};

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
}

const customRender = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { queryClient, ...renderOptions } = options;

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <AllTheProviders queryClient={queryClient}>{children}</AllTheProviders>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Test data factories
export const createMockYouTubeVideoInfo = (overrides = {}) => ({
  id: 'test-video-id',
  title: 'Test Video Title',
  description: 'Test video description',
  thumbnail: 'https://img.youtube.com/vi/test-video-id/maxresdefault.jpg',
  duration: 300,
  channelTitle: 'Test Channel',
  publishedAt: '2023-01-01T00:00:00Z',
  viewCount: 1000,
  likeCount: 100,
  ...overrides,
});

export const createMockProjectData = (overrides = {}) => ({
  id: 'test-project-id',
  name: 'Test Project',
  description: 'Test project description',
  videoUrl: 'https://www.youtube.com/watch?v=test-video-id',
  segments: [],
  queue: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  visibility: 'private' as const,
  ...overrides,
});

export const createMockSegment = (overrides = {}) => ({
  id: 'test-segment-id',
  title: 'Test Segment',
  startTime: 0,
  endTime: 30,
  description: 'Test segment description',
  tags: ['test'],
  ...overrides,
});

// Mock implementations for hooks
export const createMockUseYouTubePlayer = (overrides = {}) => ({
  player: null,
  isReady: false,
  isLoading: false,
  error: null,
  play: jest.fn(),
  pause: jest.fn(),
  seekTo: jest.fn(),
  setVolume: jest.fn(),
  getCurrentTime: jest.fn(() => 0),
  getDuration: jest.fn(() => 100),
  getPlayerState: jest.fn(() => 1),
  ...overrides,
});

export const createMockUseYouTubeApi = (overrides = {}) => ({
  searchVideos: jest.fn(),
  getVideoDetails: jest.fn(),
  isLoading: false,
  error: null,
  lastSearchQuery: '',
  searchResults: [],
  ...overrides,
});

export const createMockUseProject = (overrides = {}) => ({
  projects: [],
  currentProject: null,
  isLoading: false,
  error: null,
  createProject: jest.fn(),
  updateProject: jest.fn(),
  deleteProject: jest.fn(),
  loadProject: jest.fn(),
  saveProject: jest.fn(),
  ...overrides,
});

// Async testing utilities
export const waitForLoadingToFinish = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

export const flushPromises = () => new Promise(setImmediate);

// Event simulation helpers
export const simulateKeyPress = (key: string, element?: Element) => {
  const target = element || document;
  const event = new KeyboardEvent('keydown', { key });
  target.dispatchEvent(event);
};

export const simulateVideoPlayerEvent = (eventType: string, data?: any) => {
  const event = new CustomEvent(eventType, { detail: data });
  window.dispatchEvent(event);
};

// Error testing utilities
export const expectErrorToBeHandled = async (
  errorMessage: string,
  errorCategory?: string
) => {
  // This would typically check if the error was properly logged or displayed
  // Implementation depends on your error handling system
  expect(console.error).toHaveBeenCalledWith(
    expect.stringContaining(errorMessage)
  );
};

// Mock data providers
export const mockFetch = (data: any, ok = true, status = 200) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  });
};

export const mockFetchError = (message = 'Network error') => {
  global.fetch = jest.fn().mockRejectedValue(new Error(message));
};

// Re-export everything from React Testing Library
export * from '@testing-library/react';
export { customRender as render };
export { createTestQueryClient }; 