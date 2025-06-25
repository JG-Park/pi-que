import { useState, useEffect, useRef, useCallback } from 'react'
import type { DebounceOptions } from '@/types/hooks'

export interface UseDebounceReturn<T> {
  debouncedValue: T
  isDebouncing: boolean
  cancel: () => void
  flush: () => void
}

export function useDebounce<T>(
  value: T,
  options: DebounceOptions
): UseDebounceReturn<T> {
  const { delay, leading = false, trailing = true, maxWait } = options
  
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  const [isDebouncing, setIsDebouncing] = useState(false)
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const maxTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastCallTimeRef = useRef<number>(0)
  const lastInvokeTimeRef = useRef<number>(0)
  const leadingRef = useRef<boolean>(true)
  
  const clearTimeouts = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current)
      maxTimeoutRef.current = null
    }
  }, [])
  
  const invokeFunc = useCallback((newValue: T) => {
    setDebouncedValue(newValue)
    setIsDebouncing(false)
    lastInvokeTimeRef.current = Date.now()
  }, [])
  
  const cancel = useCallback(() => {
    clearTimeouts()
    setIsDebouncing(false)
    leadingRef.current = true
  }, [clearTimeouts])
  
  const flush = useCallback(() => {
    if (timeoutRef.current) {
      invokeFunc(value)
      clearTimeouts()
    }
  }, [value, invokeFunc, clearTimeouts])
  
  useEffect(() => {
    const currentTime = Date.now()
    lastCallTimeRef.current = currentTime
    
    const shouldInvokeLeading = leading && leadingRef.current
    const timeSinceLastInvoke = currentTime - lastInvokeTimeRef.current
    const shouldInvokeMaxWait = maxWait && timeSinceLastInvoke >= maxWait
    
    if (shouldInvokeLeading) {
      leadingRef.current = false
      invokeFunc(value)
      return
    }
    
    if (shouldInvokeMaxWait) {
      invokeFunc(value)
      return
    }
    
    clearTimeouts()
    setIsDebouncing(true)
    
    // 최대 대기 시간 설정
    if (maxWait) {
      const remainingMaxWait = maxWait - timeSinceLastInvoke
      if (remainingMaxWait > 0) {
        maxTimeoutRef.current = setTimeout(() => {
          invokeFunc(value)
        }, remainingMaxWait)
      }
    }
    
    // 일반 디바운스 타이머
    if (trailing) {
      timeoutRef.current = setTimeout(() => {
        const timeSinceLastCall = Date.now() - lastCallTimeRef.current
        
        if (timeSinceLastCall < delay) {
          // 아직 충분한 시간이 지나지 않았으면 다시 대기
          timeoutRef.current = setTimeout(() => {
            invokeFunc(value)
          }, delay - timeSinceLastCall)
        } else {
          invokeFunc(value)
        }
      }, delay)
    }
    
    return () => {
      clearTimeouts()
    }
  }, [value, delay, leading, trailing, maxWait, invokeFunc, clearTimeouts])
  
  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      clearTimeouts()
    }
  }, [clearTimeouts])
  
  return {
    debouncedValue,
    isDebouncing,
    cancel,
    flush,
  }
}

// 간단한 디바운스 훅 (값만 디바운스)
export function useDebounceValue<T>(value: T, delay: number): T {
  const { debouncedValue } = useDebounce(value, { delay })
  return debouncedValue
}

// 함수 디바운스 훅
export function useDebounceCallback<T extends (...args: any[]) => any>(
  callback: T,
  options: DebounceOptions
): {
  debouncedCallback: T
  cancel: () => void
  flush: () => void
  isDebouncing: boolean
} {
  const { delay, leading = false, trailing = true, maxWait } = options
  
  const [isDebouncing, setIsDebouncing] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const maxTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastCallTimeRef = useRef<number>(0)
  const lastInvokeTimeRef = useRef<number>(0)
  const leadingRef = useRef<boolean>(true)
  const argsRef = useRef<Parameters<T> | null>(null)
  
  const clearTimeouts = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current)
      maxTimeoutRef.current = null
    }
  }, [])
  
  const invokeFunc = useCallback(() => {
    if (argsRef.current) {
      callback(...argsRef.current)
      setIsDebouncing(false)
      lastInvokeTimeRef.current = Date.now()
    }
  }, [callback])
  
  const cancel = useCallback(() => {
    clearTimeouts()
    setIsDebouncing(false)
    leadingRef.current = true
    argsRef.current = null
  }, [clearTimeouts])
  
  const flush = useCallback(() => {
    if (timeoutRef.current) {
      invokeFunc()
      clearTimeouts()
    }
  }, [invokeFunc, clearTimeouts])
  
  const debouncedCallback = useCallback(
    ((...args: Parameters<T>) => {
      const currentTime = Date.now()
      argsRef.current = args
      lastCallTimeRef.current = currentTime
      
      const shouldInvokeLeading = leading && leadingRef.current
      const timeSinceLastInvoke = currentTime - lastInvokeTimeRef.current
      const shouldInvokeMaxWait = maxWait && timeSinceLastInvoke >= maxWait
      
      if (shouldInvokeLeading) {
        leadingRef.current = false
        invokeFunc()
        return
      }
      
      if (shouldInvokeMaxWait) {
        invokeFunc()
        return
      }
      
      clearTimeouts()
      setIsDebouncing(true)
      
      // 최대 대기 시간 설정
      if (maxWait) {
        const remainingMaxWait = maxWait - timeSinceLastInvoke
        if (remainingMaxWait > 0) {
          maxTimeoutRef.current = setTimeout(invokeFunc, remainingMaxWait)
        }
      }
      
      // 일반 디바운스 타이머
      if (trailing) {
        timeoutRef.current = setTimeout(() => {
          const timeSinceLastCall = Date.now() - lastCallTimeRef.current
          
          if (timeSinceLastCall < delay) {
            timeoutRef.current = setTimeout(invokeFunc, delay - timeSinceLastCall)
          } else {
            invokeFunc()
          }
        }, delay)
      }
    }) as T,
    [callback, delay, leading, trailing, maxWait, invokeFunc, clearTimeouts]
  )
  
  useEffect(() => {
    return () => {
      clearTimeouts()
    }
  }, [clearTimeouts])
  
  return {
    debouncedCallback,
    cancel,
    flush,
    isDebouncing,
  }
} 