'use client';

import { useState, useRef, useEffect, useCallback, FormEvent } from 'react';

export interface UseFilterStateOptions<T> {
  initialState: T;
  onApply: (filters: T) => void;
  autoApply?: boolean;
  debounceMs?: number;
  debounceFields?: Array<keyof T>;
}

export function useFilterState<T extends Record<string, any>>({
  initialState,
  onApply,
  autoApply = true,
  debounceMs = 350,
  debounceFields = [],
}: UseFilterStateOptions<T>) {
  const [formState, setFormState] = useState<T>(initialState);
  const [isDebouncing, setIsDebouncing] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestStateRef = useRef<T>(formState);
  const onApplyRef = useRef(onApply);

  useEffect(() => {
    onApplyRef.current = onApply;
  }, [onApply]);

  useEffect(() => {
    latestStateRef.current = formState;
  }, [formState]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const cancelDebounce = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      setIsDebouncing(false);
    }
  }, []);

  const applyImmediately = useCallback((stateToApply: T) => {
    cancelDebounce();
    onApplyRef.current(stateToApply);
  }, [cancelDebounce]);

  const scheduleDebounce = useCallback((stateToApply: T) => {
    cancelDebounce();
    setIsDebouncing(true);
    debounceTimerRef.current = setTimeout(() => {
      setIsDebouncing(false);
      debounceTimerRef.current = null;
      onApplyRef.current(stateToApply);
    }, debounceMs);
  }, [cancelDebounce, debounceMs]);

  const setField = useCallback(<K extends keyof T>(
    key: K,
    value: T[K],
    options?: { immediate?: boolean },
  ) => {
    const nextState = { ...latestStateRef.current, [key]: value };
    latestStateRef.current = nextState;
    setFormState(nextState);

    if (autoApply) {
      const isImmediate = options?.immediate === true || (options?.immediate !== false && !debounceFields.includes(key));
      if (isImmediate) {
        applyImmediately(nextState);
      } else {
        scheduleDebounce(nextState);
      }
    }
  }, [autoApply, debounceFields, applyImmediately, scheduleDebounce]);

  const setFormStateCustom = useCallback((
    updater: T | ((prev: T) => T),
    options?: { immediate?: boolean },
  ) => {
    const prev = latestStateRef.current;
    const nextState = typeof updater === 'function' ? (updater as (prev: T) => T)(prev) : updater;
    latestStateRef.current = nextState;
    setFormState(nextState);

    if (autoApply) {
      if (options?.immediate ?? true) {
        applyImmediately(nextState);
      } else {
        scheduleDebounce(nextState);
      }
    }
  }, [autoApply, applyImmediately, scheduleDebounce]);

  const handleClear = useCallback((defaultClearState: T = initialState) => {
    cancelDebounce();
    setFormState(defaultClearState);
    latestStateRef.current = defaultClearState;
    onApplyRef.current(defaultClearState);
  }, [cancelDebounce, initialState]);

  const handleSubmit = useCallback((e?: FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    cancelDebounce();
    onApplyRef.current(latestStateRef.current);
  }, [cancelDebounce]);

  const applyNow = useCallback((override?: Partial<T>) => {
    cancelDebounce();
    const targetState = override ? { ...latestStateRef.current, ...override } : latestStateRef.current;
    if (override) {
      setFormState(targetState);
      latestStateRef.current = targetState;
    }
    onApplyRef.current(targetState);
  }, [cancelDebounce]);

  return {
    formState,
    setFormState: setFormStateCustom,
    setField,
    handleClear,
    handleSubmit,
    applyNow,
    isDebouncing,
    cancelDebounce,
  };
}
