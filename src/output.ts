export function printJSON(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function handleError(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  console.error(JSON.stringify({ error: message }));
  process.exit(1);
}
