/**
 * Concurrency utilities for controlled parallel execution.
 * Used by sync services to parallelize API calls without exceeding rate limits.
 */

interface ConcurrentTask<T> {
  fn: () => Promise<T>;
}

/**
 * Execute an array of async tasks with a concurrency limit.
 * Returns results in the same order as the input tasks.
 * Failed tasks return the error instead of throwing — caller decides how to handle.
 */
export async function runConcurrent<T>(
  tasks: ConcurrentTask<T>[],
  concurrency: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      try {
        const value = await tasks[index].fn();
        results[index] = { status: 'fulfilled', value };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker(),
  );

  await Promise.all(workers);
  return results;
}
