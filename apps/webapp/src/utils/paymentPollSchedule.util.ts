export interface PaymentPollState<Result> {
  readonly data: Result | undefined;
  readonly error: unknown;
  readonly dataUpdateCount: number;
  readonly errorUpdateCount: number;
}

export function nextPaymentPollDelay<Result>(
  state: PaymentPollState<Result>,
  isPending: (result: Result) => boolean,
  isTransientFailure: (error: unknown) => boolean,
  intervalMs: number,
  maxAttempts: number,
): number | false {
  if (state.error && !isTransientFailure(state.error)) return false;
  const stillPending = state.data === undefined || isPending(state.data);
  return stillPending && state.dataUpdateCount + state.errorUpdateCount < maxAttempts ? intervalMs : false;
}
