export async function withTimeout<T>(request: PromiseLike<T>, milliseconds = 20_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([Promise.resolve(request), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Request timed out. Please retry.")), milliseconds);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}