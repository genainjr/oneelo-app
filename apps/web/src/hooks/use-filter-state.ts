import { useState, FormEvent } from 'react';

interface UseFilterStateOptions<T> {
  initialState: T;
  onApply: (filters: T) => void;
}

export function useFilterState<T>({ initialState, onApply }: UseFilterStateOptions<T>) {
  const [formState, setFormState] = useState<T>(initialState);

  const setField = <K extends keyof T>(key: K, value: T[K]) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleClear = (defaultClearState: T = initialState) => {
    setFormState(defaultClearState);
    onApply(defaultClearState);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onApply(formState);
  };

  return {
    formState,
    setFormState,
    setField,
    handleClear,
    handleSubmit,
  };
}
