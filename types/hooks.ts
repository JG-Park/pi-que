// React Hook Types for Pi-Que Application

// Base hook state
export interface BaseHookState {
  isLoading: boolean;
  error: Error | null;
  isSuccess: boolean;
}

// YouTube Video Info
export interface YouTubeVideoInfo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: number;
  channelTitle: string;
  publishedAt: string;
}

// Project types
export interface Project {
  id: string;
  name: string;
  description: string;
  videoUrl?: string;
  segments: Segment[];
  createdAt: Date;
  updatedAt: Date;
}

// Segment types
export interface Segment {
  id: string;
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  tags: string[];
}

// Queue types
export interface QueueItem {
  id: string;
  segmentId: string;
  segment: Segment;
  order: number;
}

// Video search hook
export interface UseVideoSearchState extends BaseHookState {
  data: YouTubeVideoInfo[] | null;
  search: (query: string) => Promise<void>;
  hasNextPage: boolean;
  loadMore: () => Promise<void>;
  reset: () => void;
}

// Segment manager hook
export interface UseSegmentManagerState extends BaseHookState {
  segments: Segment[];
  selectedIds: string[];
  create: (segment: Partial<Segment>) => Promise<Segment>;
  update: (id: string, updates: Partial<Segment>) => Promise<Segment>;
  delete: (id: string) => Promise<void>;
  selectSegment: (id: string, multiSelect?: boolean) => void;
  clearSelection: () => void;
}

// Queue manager hook
export interface UseQueueManagerState extends BaseHookState {
  queue: QueueItem[];
  currentItem: QueueItem | null;
  isPlaying: boolean;
  add: (segmentId: string) => Promise<QueueItem>;
  remove: (id: string) => Promise<void>;
  play: (id?: string) => Promise<void>;
  pause: () => void;
  next: () => Promise<QueueItem | null>;
  previous: () => Promise<QueueItem | null>;
}

// Auto-save hook
export interface UseAutoSaveState extends BaseHookState {
  isSaving: boolean;
  lastSavedAt: Date | null;
  hasUnsavedChanges: boolean;
  save: (data?: any) => Promise<void>;
  setEnabled: (enabled: boolean) => void;
}

// Modal hook
export interface UseModalState {
  isOpen: boolean;
  data?: any;
  openModal: (data?: any) => void;
  closeModal: () => void;
  toggleModal: (data?: any) => void;
}

// Form state hook
export interface UseFormState<T = any> extends BaseHookState {
  values: T;
  setValue: (name: keyof T, value: any) => void;
  setValues: (values: Partial<T>) => void;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  reset: (values?: T) => void;
  isDirty: boolean;
  isSubmitting: boolean;
  isValid: boolean;
}

// Scroll hook
export interface UseScrollState {
  inView: boolean;
  ref: React.RefObject<Element>;
  scrollY: number;
  hasNextPage: boolean;
  fetchNextPage: () => Promise<void>;
}

// Hook configuration types
export interface AutoSaveOptions {
  delay?: number;
  maxRetries?: number;
  enabled?: boolean;
  onSave?: (data: any) => Promise<void>;
  onError?: (error: Error) => void;
  onSuccess?: () => void;
}

export interface ScrollOptions {
  threshold?: number;
  rootMargin?: string;
  enabled?: boolean;
}

export interface FormValidationOptions<T> {
  initialValues: T;
  validate?: (values: T) => Record<string, string>;
  onSubmit?: (values: T) => Promise<void> | void;
} 