export function printJSON(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function plainError(message: string): Error {
  const err = new Error(message);
  (err as { plain?: boolean }).plain = true;
  return err;
}

export function handleError(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  const plain = err instanceof Error && (err as { plain?: boolean }).plain === true;
  if (plain) {
    console.error(message);
  } else {
    console.error(JSON.stringify({ error: message }));
  }
  process.exit(1);
}
