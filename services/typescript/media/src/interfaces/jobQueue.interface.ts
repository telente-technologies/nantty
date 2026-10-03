export interface Job {
  readonly id: string;
  readonly type: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface JobQueue {
  enqueueJob(queueName: string, job: Job, delayMilliseconds?: number): Promise<void>;
}

export interface JobAttempt {
  readonly attempt: number;
  readonly maximumAttempts: number;
  readonly isFinalAttempt: boolean;
}

export type JobHandler = (payload: Readonly<Record<string, unknown>>, attempt: JobAttempt) => Promise<void>;
export type JobHandlers = Readonly<Record<string, JobHandler>>;
