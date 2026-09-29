"use client";

import { useEffect, useRef, useState } from "react";

export function useMeasuredElementWidth<ElementType extends HTMLElement>(fallbackWidth: number) {
  const elementRef = useRef<ElementType>(null);
  const [width, setWidth] = useState(fallbackWidth);
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width;
      if (measured && measured > 0) setWidth(Math.floor(measured));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { elementRef, width };
}
