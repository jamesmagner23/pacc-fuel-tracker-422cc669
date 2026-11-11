// Cron credentials never grant access to any endpoint other than this sync.
export async function authorizeSync(
  headers: Headers,
  dependencies: {
    readCronToken: () => Promise<string | null>;
    validateAdmin: (jwt: string) => Promise<401 | 403 | null>;
  },
): Promise<401 | 403 | null> {
  const supplied = headers.get("x-cron-token");
  if (supplied) {
    const expected = await dependencies.readCronToken().catch(() => null);
    if (expected && supplied === expected) return null;
  }
  const match = /^Bearer ([^\s,]+)$/.exec(headers.get("Authorization") ?? "");
  if (!match) return 401;
  return dependencies.validateAdmin(match[1]);
}

export function syncFailureResponse(recordsFetched: number, headers: HeadersInit): Response {
  return new Response(JSON.stringify({ success: false, error: "Sync failed", records_fetched: recordsFetched }), {
    status: 500, headers,
  });
}