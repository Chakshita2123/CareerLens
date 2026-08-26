'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Persist a value to localStorage, hydrating safely on the client only.
 * Avoids SSR mismatch by returning the initialValue during server render.
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [stored, setStored] = useState<T>(initialValue)

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key)
      if (item) setStored(JSON.parse(item) as T)
    } catch {}
  }, [key])

  const set = useCallback(
    (value: T) => {
      setStored(value)
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
      } catch {}
    },
    [key]
  )

  return [stored, set] as const
}

/**
 * Generate and persist a random user ID in localStorage.
 * Used as a stand-in for real auth (Phase 6 scope constraint).
 */
export function useUserId(): string {
  const [userId, setUserId] = useLocalStorage<string>('cl_user_id', '')

  useEffect(() => {
    if (!userId) {
      const id = `user_${Math.random().toString(36).slice(2, 10)}`
      setUserId(id)
    }
  }, [userId, setUserId])

  return userId
}

/**
 * Persist the currently selected resume version ID.
 */
export function useSelectedVersion() {
  return useLocalStorage<string>('cl_version_id', '')
}

/**
 * Animate a number from 0 to `target` over `duration` ms.
 * Returns the current animated value. The animation starts when `start` is true.
 */
export function useCountUp(target: number, duration = 1200, start = true): number {
  const [current, setCurrent] = useState(0)
  const frameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)

  useEffect(() => {
    if (!start) return

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp
      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.round(eased * target))

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate)
      }
    }

    frameRef.current = requestAnimationFrame(animate)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      startTimeRef.current = null
    }
  }, [target, duration, start])

  return current
}

/**
 * Detect when an element enters the viewport (used to trigger animations).
 */
export function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return { ref, inView }
}

/** Debounce a callback by `delay` ms. */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
