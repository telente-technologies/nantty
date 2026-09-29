export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitBreakerOptions {
  readonly consecutiveFailuresToOpen: number;
  readonly errorRatePercentToOpen: number;
  readonly errorRateWindowMs: number;
  readonly minimumRequestsForErrorRate: number;
  readonly halfOpenAfterMs: number;
}

interface RecordedOutcome {
  readonly atMs: number;
  readonly succeeded: boolean;
}

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private consecutiveFailures = 0;
  private openedAtMs = 0;
  private trialInFlight = false;
  private outcomes: RecordedOutcome[] = [];

  public constructor(private readonly options: CircuitBreakerOptions, private readonly readNowMs: () => number) {}

  public currentState(): CircuitState {
    if (this.state === "open" && this.readNowMs() - this.openedAtMs >= this.options.halfOpenAfterMs) this.state = "half_open";
    return this.state;
  }

  public tryAcquirePermission(): boolean {
    const state = this.currentState();
    if (state === "closed") return true;
    if (state === "open" || this.trialInFlight) return false;
    this.trialInFlight = true;
    return true;
  }

  public recordSuccess(): void {
    this.trialInFlight = false;
    this.consecutiveFailures = 0;
    if (this.state !== "closed") {
      this.state = "closed";
      this.outcomes = [];
      return;
    }
    this.rememberOutcome(true);
  }

  public recordFailure(): void {
    this.trialInFlight = false;
    if (this.state === "half_open") {
      this.openCircuit();
      return;
    }
    this.consecutiveFailures += 1;
    this.rememberOutcome(false);
    if (this.consecutiveFailures >= this.options.consecutiveFailuresToOpen || this.errorRateExceeded()) this.openCircuit();
  }

  private openCircuit(): void {
    this.state = "open";
    this.openedAtMs = this.readNowMs();
    this.consecutiveFailures = 0;
    this.outcomes = [];
  }

  private rememberOutcome(succeeded: boolean): void {
    const nowMs = this.readNowMs();
    this.outcomes = [...this.outcomes.filter((outcome) => nowMs - outcome.atMs < this.options.errorRateWindowMs), { atMs: nowMs, succeeded }];
  }

  private errorRateExceeded(): boolean {
    if (this.outcomes.length < this.options.minimumRequestsForErrorRate) return false;
    const failures = this.outcomes.filter((outcome) => !outcome.succeeded).length;
    return (failures * 100) / this.outcomes.length > this.options.errorRatePercentToOpen;
  }
}
