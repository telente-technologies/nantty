"use client";

import { useEffect, useState } from "react";

export function useDebouncedValue<Value>(value: Value, delayInMilliseconds: number): Value {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timeoutHandle = setTimeout(() => setDebouncedValue(value), delayInMilliseconds);
    return () => clearTimeout(timeoutHandle);
  }, [value, delayInMilliseconds]);
  return debouncedValue;
}
