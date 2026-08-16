import { useState, useEffect } from 'react';

/**
 * Custom hook to debounce rapid value updates (e.g., search queries)
 * to prevent unnecessary re-computations and excessive database query loads.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
