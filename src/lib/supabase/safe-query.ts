export async function withTimeout<T>(
  label: string,
  promise: PromiseLike<unknown>,
  fallback: T,
  timeoutMs = 10000,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<T>((resolve) => {
    timeout = setTimeout(() => {
      console.warn(`[supabase] ${label} timed out after ${timeoutMs}ms`);
      resolve(fallback);
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(promise) as Promise<T>, timeoutPromise]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[supabase] ${label} failed: ${message}`);
    return fallback;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
