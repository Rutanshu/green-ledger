import { describe, expect, it } from "vitest";
import { csvHeaders, CsvParseError, parseCsvRows } from "./parse";

describe("parseCsvRows", () => {
  it("parses a simple CSV into rows keyed by header", () => {
    const text = "site_code,question_code,value\nMI-AD-04,diesel_qty,3100\nMI-NG-01,diesel_qty,14200\n";
    const rows = [...parseCsvRows(text)];
    expect(rows).toHaveLength(2);
    expect(rows[0].cells).toEqual({ site_code: "MI-AD-04", question_code: "diesel_qty", value: "3100" });
    expect(rows[1].lineNumber).toBe(3);
  });

  it("handles a quoted field containing a comma", () => {
    const text = 'site_code,note\nMI-AD-04,"corrected, per invoice"\n';
    const rows = [...parseCsvRows(text)];
    expect(rows[0].cells.note).toBe("corrected, per invoice");
  });

  it("handles an escaped double-quote inside a quoted field", () => {
    const text = 'site_code,note\nMI-AD-04,"the ""real"" reading"\n';
    const rows = [...parseCsvRows(text)];
    expect(rows[0].cells.note).toBe('the "real" reading');
  });

  it("skips blank lines", () => {
    const text = "site_code,value\nMI-AD-04,3100\n\nMI-NG-01,14200\n";
    const rows = [...parseCsvRows(text)];
    expect(rows).toHaveLength(2);
  });

  it("throws CsvParseError on an unterminated quote", () => {
    const text = 'site_code,note\nMI-AD-04,"unterminated\n';
    expect(() => [...parseCsvRows(text)]).toThrow(CsvParseError);
  });

  it("processes rows one at a time (generator, not a materialised array)", () => {
    const text = "a\n1\n2\n3\n";
    const gen = parseCsvRows(text);
    const first = gen.next();
    expect(first.done).toBe(false);
    expect(first.value?.cells.a).toBe("1");
  });
});

describe("csvHeaders", () => {
  it("returns the header row split into cells", () => {
    expect(csvHeaders("a,b,c\n1,2,3\n")).toEqual(["a", "b", "c"]);
  });
  it("returns an empty array for an empty file", () => {
    expect(csvHeaders("")).toEqual([]);
  });
});
