/**
 * CSV parsing. GHG_TOOL_ARCHITECTURE.md §12, BUILD_PLAN Step 3.5: "streamed
 * xlsx/csv parser... must handle 100,000 rows without loading everything
 * into memory." `parseCsvRows` is a generator over already-read text — it
 * yields one row at a time rather than materialising every row's parsed
 * cells into one big array, so a caller processing rows one at a time
 * (validate, stage, discard) never holds more than one row's cells at
 * once. It does NOT stream off disk — this app has no background-job
 * infrastructure to run a true streamed multipart upload against, so the
 * whole file is read into a string first. That's the honest scope: the
 * per-row memory discipline is real, the off-disk streaming isn't.
 *
 * PURE MODULE — no fs, no fetch.
 */
export class CsvParseError extends Error {
  constructor(readonly lineNumber: number, message: string) {
    super(`Line ${lineNumber}: ${message}`);
    this.name = "CsvParseError";
  }
}

/** Splits one CSV line into cells, honouring double-quoted fields containing commas or escaped quotes (""). */
function splitLine(line: string, lineNumber: number): string[] {
  const cells: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      if (cell.length > 0) throw new CsvParseError(lineNumber, "unexpected quote in the middle of an unquoted field");
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cell);
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (inQuotes) throw new CsvParseError(lineNumber, "unterminated quoted field");
  cells.push(cell);
  return cells;
}

export interface CsvRow {
  lineNumber: number;
  cells: Readonly<Record<string, string>>;
}

/** First line is the header. Blank lines are skipped. Yields one row at a time. */
export function* parseCsvRows(text: string): Generator<CsvRow> {
  const lines = text.split(/\r\n|\r|\n/);
  let headers: string[] | null = null;
  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const line = lines[i];
    if (line.trim() === "") continue;
    const cells = splitLine(line, lineNumber);
    if (!headers) {
      headers = cells.map((h) => h.trim());
      continue;
    }
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = (cells[idx] ?? "").trim();
    });
    yield { lineNumber, cells: record };
  }
}

export function csvHeaders(text: string): string[] {
  const firstLine = text.split(/\r\n|\r|\n/).find((l) => l.trim() !== "");
  if (!firstLine) return [];
  return splitLine(firstLine, 1).map((h) => h.trim());
}
