import { useEffect, useState, useRef } from "react";
import { useDebounce } from "./use-debounce";

interface UseAutoSaveOptions {
  delay?: number;
  enabled?: boolean;
  onSave?: (value: any) => Promise<void> | void;
}

interface UseAutoSaveReturn {
  isSaving: boolean;
  lastSaved: Date | null;
  error: Error | null;
}

/**
 * Deep equality check using JSON.stringify.
 * Note: This works for simple objects/arrays. For complex cases, consider a proper deep equality library.
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    // If JSON.stringify fails (circular refs, etc.), fall back to reference equality
    return a === b;
  }
}

/**
 * Hook for auto-saving values with debouncing.
 * 
 * @param value - The value to watch for changes
 * @param options - Configuration options
 * @returns Object with saving state and metadata
 */
export function useAutoSave<T>(
  value: T,
  options: UseAutoSaveOptions = {}
): UseAutoSaveReturn {
  const { delay = 1000, enabled = true, onSave } = options;
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);
  
  const previousValueRef = useRef<T>(value);
  const onSaveRef = useRef(onSave);
  const isInitialMountRef = useRef(true);
  
  // Update ref when onSave changes
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);
  
  // Debounce the value
  const debouncedValue = useDebounce(value, delay);
  
  // Save when debounced value changes
  useEffect(() => {
    if (!enabled || !onSaveRef.current) {
      return;
    }
    
    // Skip initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      previousValueRef.current = debouncedValue;
      return;
    }
    
    // Only save if value actually changed (deep comparison)
    if (deepEqual(debouncedValue, previousValueRef.current)) {
      return;
    }
    
    const performSave = async () => {
      setIsSaving(true);
      setError(null);
      
      try {
        // Use the latest debounced value
        await onSaveRef.current?.(debouncedValue);
        setLastSaved(new Date());
        previousValueRef.current = debouncedValue;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsSaving(false);
      }
    };
    
    performSave();
  }, [debouncedValue, enabled]);
  
  // Update previous value ref when value changes (for tracking)
  useEffect(() => {
    // Only update if it's not the initial mount and values are different
    if (!isInitialMountRef.current && !deepEqual(value, previousValueRef.current)) {
      // Don't update here - let the debounced effect handle it
    }
  }, [value]);
  
  return {
    isSaving,
    lastSaved,
    error,
  };
}

