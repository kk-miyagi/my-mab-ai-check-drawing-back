import pLimit from 'p-limit';

// Run async worker over items with concurrency limit. Returns results in input order.
export async function runWithLimit<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const limit = pLimit(Math.max(1, concurrency));
  return Promise.all(items.map((item, index) => limit(() => worker(item, index))));
}
