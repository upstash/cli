export function printJSON(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function printTable(headers: string[], rows: string[][]): void {
  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)),
  );
  const formatRow = (row: string[]) =>
    row.map((val, i) => val.padEnd(colWidths[i]!)).join("  ");
  console.log(formatRow(headers));
  for (const row of rows) {
    console.log(formatRow(row));
  }
}

export function printKeyValue(obj: Record<string, unknown>): void {
  const maxKeyLen = Math.max(...Object.keys(obj).map((k) => k.length));
  for (const [key, val] of Object.entries(obj)) {
    const formatted = Array.isArray(val)
      ? val.join(", ")
      : val === null || val === undefined
        ? ""
        : String(val);
    console.log(`${key.padEnd(maxKeyLen + 2)}${formatted}`);
  }
}

export function handleError(err: unknown, json: boolean): never {
  const message = err instanceof Error ? err.message : String(err);
  if (json) {
    console.error(JSON.stringify({ error: message }));
  } else {
    console.error(`Error: ${message}`);
  }
  process.exit(1);
}
