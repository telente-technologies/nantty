"use client";

import { useCallback, useState } from "react";

import { AdminApiRequestError, readErrorMessageForDisplay } from "@/services/adminApiClient.service";
import type { ApiValidationIssue } from "@/types/api.type";

export interface AdminMutationState<Input, Output> {
  readonly run: (input: Input) => Promise<Output | null>;
  readonly isRunning: boolean;
  readonly errorMessage: string | null;
  readonly error: unknown;
  readonly validationIssues: readonly ApiValidationIssue[];
  readonly clearError: () => void;
}

export function useAdminMutation<Input, Output>(performMutation: (input: Input) => Promise<Output>): AdminMutationState<Input, Output> {
  const [isRunning, setIsRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [validationIssues, setValidationIssues] = useState<readonly ApiValidationIssue[]>([]);

  const run = useCallback(
    async (input: Input) => {
      setIsRunning(true);
      setErrorMessage(null);
      setError(null);
      setValidationIssues([]);
      try {
        return await performMutation(input);
      } catch (error) {
        setError(error);
        setErrorMessage(readErrorMessageForDisplay(error));
        if (error instanceof AdminApiRequestError) setValidationIssues(error.issues);
        return null;
      } finally {
        setIsRunning(false);
      }
    },
    [performMutation],
  );

  const clearError = useCallback(() => {
    setErrorMessage(null);
    setError(null);
    setValidationIssues([]);
  }, []);

  return { run, isRunning, errorMessage, error, validationIssues, clearError };
}
