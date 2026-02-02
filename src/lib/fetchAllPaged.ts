/**
 * Fetches all rows from a paginated endpoint using (from,to) ranges.
 * Useful to avoid the default PostgREST 1000 rows limit.
 */
export async function fetchAllPaged<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize: number = 1000
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;

  // Safety cap to prevent infinite loops in case of unexpected API behavior
  const maxPages = 200; // 200 * 1000 = 200k rows
  for (let page = 0; page < maxPages; page++) {
    const to = from + pageSize - 1;
    const data = await fetchPage(from, to);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}
