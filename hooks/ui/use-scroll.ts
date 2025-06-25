'use client';

import { useInView } from 'react-intersection-observer';
import { useCallback, useState, useEffect, useRef } from 'react';

export interface UseScrollObserverOptions {
  /**
   * Threshold for triggering intersection (0-1)
   */
  threshold?: number;
  /**
   * Root margin for intersection observer
   */
  rootMargin?: string;
  /**
   * Whether to trigger only once
   */
  triggerOnce?: boolean;
  /**
   * Delay before triggering callback (ms)
   */
  delay?: number;
  /**
   * Skip observation if condition is false
   */
  skip?: boolean;
}

export interface UseScrollObserverReturn {
  /**
   * Ref to attach to the target element
   */
  ref: (node?: Element | null) => void;
  /**
   * Whether element is currently in view
   */
  inView: boolean;
  /**
   * Intersection observer entry
   */
  entry?: IntersectionObserverEntry;
}

/**
 * Basic scroll observation hook using Intersection Observer
 * 
 * @example
 * ```tsx
 * const { ref, inView } = useScrollObserver({
 *   threshold: 0.5,
 *   triggerOnce: true
 * });
 * 
 * return (
 *   <div ref={ref} className={inView ? 'animate-fadeIn' : ''}>
 *     Content that animates when in view
 *   </div>
 * );
 * ```
 */
export function useScrollObserver(options: UseScrollObserverOptions = {}): UseScrollObserverReturn {
  const {
    threshold = 0,
    rootMargin = '0px',
    triggerOnce = false,
    delay = 0,
    skip = false,
  } = options;

  const { ref, inView, entry } = useInView({
    threshold,
    rootMargin,
    triggerOnce,
    delay,
    skip,
  });

  return { ref, inView, entry };
}

export interface UseInfiniteScrollOptions<T = any> {
  /**
   * Function to load more data
   */
  loadMore: () => Promise<T[]> | T[];
  /**
   * Whether there are more items to load
   */
  hasMore: boolean;
  /**
   * Loading state (external)
   */
  isLoading?: boolean;
  /**
   * Error state (external)
   */
  error?: Error | null;
  /**
   * Threshold for triggering load more
   */
  threshold?: number;
  /**
   * Root margin for intersection observer
   */
  rootMargin?: string;
  /**
   * Whether to load initial data automatically
   */
  initialLoad?: boolean;
  /**
   * Delay before loading more (ms)
   */
  loadDelay?: number;
  /**
   * Disabled state
   */
  disabled?: boolean;
}

export interface UseInfiniteScrollReturn {
  /**
   * Ref to attach to the loading trigger element
   */
  ref: (node?: Element | null) => void;
  /**
   * Whether currently loading
   */
  isLoading: boolean;
  /**
   * Whether load more trigger is in view
   */
  inView: boolean;
  /**
   * Manually trigger load more
   */
  loadMore: () => Promise<void>;
  /**
   * Reset loading state
   */
  reset: () => void;
}

/**
 * Infinite scroll hook with automatic loading
 * 
 * @example
 * ```tsx
 * const [items, setItems] = useState([]);
 * const [hasMore, setHasMore] = useState(true);
 * 
 * const { ref, isLoading } = useInfiniteScroll({
 *   loadMore: async () => {
 *     const newItems = await fetchItems(items.length);
 *     setItems(prev => [...prev, ...newItems]);
 *     if (newItems.length === 0) setHasMore(false);
 *     return newItems;
 *   },
 *   hasMore,
 *   threshold: 0.5
 * });
 * 
 * return (
 *   <div>
 *     {items.map(item => <div key={item.id}>{item.name}</div>)}
 *     {hasMore && (
 *       <div ref={ref}>
 *         {isLoading ? 'Loading...' : 'Load more'}
 *       </div>
 *     )}
 *   </div>
 * );
 * ```
 */
export function useInfiniteScroll<T = any>(
  options: UseInfiniteScrollOptions<T>
): UseInfiniteScrollReturn {
  const {
    loadMore: loadMoreFn,
    hasMore,
    isLoading: externalLoading = false,
    error,
    threshold = 0.1,
    rootMargin = '100px',
    initialLoad = false,
    loadDelay = 0,
    disabled = false,
  } = options;

  const [internalLoading, setInternalLoading] = useState(false);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(!initialLoad);
  const loadingRef = useRef(false);

  const isLoading = externalLoading || internalLoading;

  const { ref, inView } = useInView({
    threshold,
    rootMargin,
    skip: disabled || !hasMore || isLoading || !!error,
  });

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore || isLoading || disabled || error) {
      return;
    }

    loadingRef.current = true;
    setInternalLoading(true);

    try {
      if (loadDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, loadDelay));
      }
      await loadMoreFn();
    } catch (err) {
      console.error('Error loading more data:', err);
    } finally {
      setInternalLoading(false);
      loadingRef.current = false;
    }
  }, [hasMore, isLoading, disabled, error, loadDelay, loadMoreFn]);

  const reset = useCallback(() => {
    setInternalLoading(false);
    setHasInitiallyLoaded(!initialLoad);
    loadingRef.current = false;
  }, [initialLoad]);

  // Load more when in view
  useEffect(() => {
    if (inView && hasMore && !isLoading && !disabled && !error) {
      loadMore();
    }
  }, [inView, hasMore, isLoading, disabled, error, loadMore]);

  // Initial load
  useEffect(() => {
    if (initialLoad && !hasInitiallyLoaded && !isLoading && !disabled && !error) {
      setHasInitiallyLoaded(true);
      loadMore();
    }
  }, [initialLoad, hasInitiallyLoaded, isLoading, disabled, error, loadMore]);

  return {
    ref,
    isLoading,
    inView,
    loadMore,
    reset,
  };
}

export interface UseScrollPositionOptions {
  /**
   * Throttle delay for scroll events (ms)
   */
  throttle?: number;
  /**
   * Element to observe (defaults to window)
   */
  element?: React.RefObject<HTMLElement>;
}

export interface ScrollPosition {
  x: number;
  y: number;
}

export interface UseScrollPositionReturn {
  /**
   * Current scroll position
   */
  scrollPosition: ScrollPosition;
  /**
   * Scroll to specific position
   */
  scrollTo: (x: number, y: number, options?: ScrollToOptions) => void;
  /**
   * Scroll to top
   */
  scrollToTop: (options?: ScrollToOptions) => void;
  /**
   * Scroll to bottom
   */
  scrollToBottom: (options?: ScrollToOptions) => void;
  /**
   * Whether scrolled to top
   */
  isAtTop: boolean;
  /**
   * Whether scrolled to bottom
   */
  isAtBottom: boolean;
  /**
   * Scroll direction ('up' | 'down' | null)
   */
  scrollDirection: 'up' | 'down' | null;
}

/**
 * Hook for tracking scroll position and providing scroll utilities
 * 
 * @example
 * ```tsx
 * const { scrollPosition, scrollToTop, isAtTop, scrollDirection } = useScrollPosition({
 *   throttle: 100
 * });
 * 
 * return (
 *   <div>
 *     <div>Scroll Y: {scrollPosition.y}</div>
 *     <div>Direction: {scrollDirection}</div>
 *     {!isAtTop && (
 *       <button onClick={() => scrollToTop({ behavior: 'smooth' })}>
 *         Back to Top
 *       </button>
 *     )}
 *   </div>
 * );
 * ```
 */
export function useScrollPosition(
  options: UseScrollPositionOptions = {}
): UseScrollPositionReturn {
  const { throttle = 100, element } = options;

  const [scrollPosition, setScrollPosition] = useState<ScrollPosition>({ x: 0, y: 0 });
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null);
  const [isAtTop, setIsAtTop] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(false);
  
  const lastScrollY = useRef(0);
  const throttleRef = useRef<NodeJS.Timeout | null>(null);

  const updateScrollPosition = useCallback(() => {
    const target = element?.current || window;
    const scrollElement = element?.current || document.documentElement;

    const x = element?.current ? element.current.scrollLeft : window.pageXOffset;
    const y = element?.current ? element.current.scrollTop : window.pageYOffset;

    setScrollPosition({ x, y });

    // Calculate scroll direction
    const direction = y > lastScrollY.current ? 'down' : y < lastScrollY.current ? 'up' : null;
    setScrollDirection(direction);
    lastScrollY.current = y;

    // Calculate if at top/bottom
    setIsAtTop(y <= 0);
    
    const scrollHeight = scrollElement.scrollHeight;
    const clientHeight = element?.current ? element.current.clientHeight : window.innerHeight;
    setIsAtBottom(y + clientHeight >= scrollHeight - 5); // 5px tolerance
  }, [element]);

  const throttledUpdateScrollPosition = useCallback(() => {
    if (throttleRef.current) {
      clearTimeout(throttleRef.current);
    }

    throttleRef.current = setTimeout(() => {
      updateScrollPosition();
    }, throttle);
  }, [updateScrollPosition, throttle]);

  useEffect(() => {
    const target = element?.current || window;
    
    // Initial position
    updateScrollPosition();

    // Add scroll listener
    target.addEventListener('scroll', throttledUpdateScrollPosition, { passive: true });

    return () => {
      target.removeEventListener('scroll', throttledUpdateScrollPosition);
      if (throttleRef.current) {
        clearTimeout(throttleRef.current);
      }
    };
  }, [element, throttledUpdateScrollPosition, updateScrollPosition]);

  const scrollTo = useCallback((x: number, y: number, options: ScrollToOptions = {}) => {
    const target = element?.current || window;
    
    if (element?.current) {
      element.current.scrollTo({ left: x, top: y, ...options });
    } else {
      window.scrollTo({ left: x, top: y, ...options });
    }
  }, [element]);

  const scrollToTop = useCallback((options: ScrollToOptions = {}) => {
    scrollTo(0, 0, options);
  }, [scrollTo]);

  const scrollToBottom = useCallback((options: ScrollToOptions = {}) => {
    const scrollElement = element?.current || document.documentElement;
    const scrollHeight = scrollElement.scrollHeight;
    scrollTo(0, scrollHeight, options);
  }, [scrollTo, element]);

  return {
    scrollPosition,
    scrollTo,
    scrollToTop,
    scrollToBottom,
    isAtTop,
    isAtBottom,
    scrollDirection,
  };
}

/**
 * Hook for smooth scrolling to elements
 * 
 * @example
 * ```tsx
 * const { scrollToElement } = useSmoothScroll();
 * 
 * return (
 *   <div>
 *     <button onClick={() => scrollToElement('section1')}>Go to Section 1</button>
 *     <div id="section1">Section 1 Content</div>
 *   </div>
 * );
 * ```
 */
export function useSmoothScroll() {
  const scrollToElement = useCallback((
    elementId: string | HTMLElement,
    options: ScrollIntoViewOptions = { behavior: 'smooth', block: 'start' }
  ) => {
    const element = typeof elementId === 'string' 
      ? document.getElementById(elementId)
      : elementId;
    
    if (element) {
      element.scrollIntoView(options);
    }
  }, []);

  const scrollToElementRef = useCallback((
    ref: React.RefObject<HTMLElement>,
    options: ScrollIntoViewOptions = { behavior: 'smooth', block: 'start' }
  ) => {
    if (ref.current) {
      ref.current.scrollIntoView(options);
    }
  }, []);

  return {
    scrollToElement,
    scrollToElementRef,
  };
} 