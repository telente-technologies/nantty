"use client";

import { useCallback, useRef } from "react";

import { createIdempotencyKey } from "@/services/adminApiClient.service";

export function useIdempotencyKeyPerSubmission(): (submissionSignature: string) => string {
  const keysBySignature = useRef(new Map<string, string>());
  return useCallback((submissionSignature: string) => {
    const existing = keysBySignature.current.get(submissionSignature);
    if (existing) return existing;
    const created = createIdempotencyKey();
    keysBySignature.current.set(submissionSignature, created);
    return created;
  }, []);
}
