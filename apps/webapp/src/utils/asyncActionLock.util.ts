export interface AsyncActionLock {
  current: boolean;
}

export async function runWithAsyncActionLock<T>(lock: AsyncActionLock, action: () => Promise<T>): Promise<T | undefined> {
  if (lock.current) return undefined;
  lock.current = true;
  try {
    return await action();
  } finally {
    lock.current = false;
  }
}
