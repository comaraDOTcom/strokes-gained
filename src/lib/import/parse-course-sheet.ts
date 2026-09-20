/**
 * Parses a course-card spreadsheet (already loaded into raw rows by the
 * caller, e.g. via SheetJS `sheet_to_json(sheet, { header: 1 })`) into a
 * normalised hole/tee structure, supporting the two layouts BUILD.md calls
 * out:
 *
 * - WIDE (Conor's own sheet format): one column per tee.
 *     hole | white tees | greens tees | par
 *       1  |     112     |     127     |  3
 * - LONG: one row per (hole, tee) pair.
 *     hole | tee   | yards | par | stroke index
 *       1  | White |  112  |  3  |     14
 *
 * This only parses and structurally validates (row-by-row) — it does not
 * touch the DB and does not know about club-card checksum totals (those
 * are cross-checked separately in `src/db/checksum.ts`, reused unchanged
 * by both the seed script and the importer once expected totals are known).
 */

export type RawSheet = {
  headers: string[];
  /** Data rows only — header row already stripped. */
  rows: unknown[][];
};

export type ParsedHole = {
  holeNo: number;
  par: number;
  strokeIndex: number | null;
  /** tee name -> yards */
  yards: Record<string, number>;
};

export type RowError = {
  /** 1-based row number as it appeared in the source sheet, including the header row (row 1 = header). */
  row: number;
  message: string;
};

export type ParseResult = {
  layout: 'wide' | 'long';
  teeNames: string[];
  holes: ParsedHole[];
  errors: RowError[];
};

function norm(cell: unknown): string {
  return String(cell ?? '').trim();
}

function normHeader(cell: unknown): string {
  return norm(cell).toLowerCase();
}

function toNumber(cell: unknown): number | null {
  if (cell === null || cell === undefined || cell === '') return null;
  const n = typeof cell === 'number' ? cell : Number(String(cell).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function findColumn(headers: string[], patterns: RegExp[]): number {
  const lower = headers.map(normHeader);
  for (let i = 0; i < lower.length; i++) {
    if (patterns.some((p) => p.test(lower[i]!))) return i;
  }
  return -1;
}

/** Strips a trailing "tee"/"tees" word from a header to guess the tee's name, e.g. "White Tees" -> "White". */
function teeNameFromHeader(header: string): string {
  return norm(header).replace(/\s*tees?\s*$/i, '').trim() || norm(header);
}

export function detectLayout(headers: string[]): 'wide' | 'long' {
  const teeCol = findColumn(headers, [/^tee$/, /^tee name$/, /^tee\s*box$/]);
  const yardsCol = findColumn(headers, [/^yard/, /^distance/, /^length/]);
  // LONG layout has a single "tee" column naming the tee per row, AND a
  // single yards column (as opposed to WIDE's one-yards-column-per-tee).
  return teeCol >= 0 && yardsCol >= 0 ? 'long' : 'wide';
}

function parseWide(sheet: RawSheet): ParseResult {
  const { headers, rows } = sheet;
  const errors: RowError[] = [];

  const holeCol = findColumn(headers, [/^hole/]);
  const parCol = findColumn(headers, [/^par/]);
  const siCol = findColumn(headers, [/stroke/, /^s\.?i\.?$/, /index/]);

  if (holeCol < 0) errors.push({ row: 1, message: 'No "Hole" column detected' });
  if (parCol < 0) errors.push({ row: 1, message: 'No "Par" column detected' });

  const reserved = new Set([holeCol, parCol, siCol].filter((i) => i >= 0));
  const teeCols = headers
    .map((h, i) => ({ h, i }))
    .filter(({ i }) => !reserved.has(i))
    .map(({ h, i }) => ({ name: teeNameFromHeader(h), i }));

  if (teeCols.length === 0) {
    errors.push({ row: 1, message: 'No tee yardage columns detected (every column matched hole/par/stroke index)' });
  }

  const holes: ParsedHole[] = [];
  if (holeCol >= 0 && parCol >= 0) {
    rows.forEach((row, idx) => {
      const sheetRow = idx + 2; // +1 for 1-based, +1 for the header row
      const holeCell = row[holeCol];
      if (holeCell === undefined || holeCell === null || norm(holeCell) === '') return; // blank trailing row

      const holeNo = toNumber(holeCell);
      if (holeNo === null) {
        errors.push({ row: sheetRow, message: `Hole number "${holeCell}" is not a number` });
        return;
      }
      const par = toNumber(row[parCol]);
      if (par === null) {
        errors.push({ row: sheetRow, message: `Hole ${holeNo}: par is missing or not a number` });
        return;
      }
      const strokeIndex = siCol >= 0 ? toNumber(row[siCol]) : null;

      const yards: Record<string, number> = {};
      let rowOk = true;
      for (const teeCol of teeCols) {
        const y = toNumber(row[teeCol.i]);
        if (y === null) {
          errors.push({ row: sheetRow, message: `Hole ${holeNo}: yardage missing for tee "${teeCol.name}"` });
          rowOk = false;
          continue;
        }
        yards[teeCol.name] = y;
      }

      // An incomplete row (missing yardage for a tee) is reported but not
      // carried into `holes` — a partially-filled hole is worse than a
      // clearly-missing one, since it could silently pass a "hole count is
      // 18" check while still being unusable for that tee.
      if (rowOk) holes.push({ holeNo, par, strokeIndex, yards });
    });
  }

  return { layout: 'wide', teeNames: teeCols.map((t) => t.name), holes, errors };
}

function parseLong(sheet: RawSheet): ParseResult {
  const { headers, rows } = sheet;
  const errors: RowError[] = [];

  const holeCol = findColumn(headers, [/^hole/]);
  const teeCol = findColumn(headers, [/^tee$/, /^tee name$/, /^tee\s*box$/]);
  const yardsCol = findColumn(headers, [/^yard/, /^distance/, /^length/]);
  const parCol = findColumn(headers, [/^par/]);
  const siCol = findColumn(headers, [/stroke/, /^s\.?i\.?$/, /index/]);

  if (holeCol < 0) errors.push({ row: 1, message: 'No "Hole" column detected' });
  if (teeCol < 0) errors.push({ row: 1, message: 'No "Tee" column detected' });
  if (yardsCol < 0) errors.push({ row: 1, message: 'No "Yards" column detected' });
  if (parCol < 0) errors.push({ row: 1, message: 'No "Par" column detected' });

  const holesByNo = new Map<number, ParsedHole>();
  const teeNames = new Set<string>();

  if (holeCol >= 0 && teeCol >= 0 && yardsCol >= 0 && parCol >= 0) {
    rows.forEach((row, idx) => {
      const sheetRow = idx + 2;
      const holeCell = row[holeCol];
      if (holeCell === undefined || holeCell === null || norm(holeCell) === '') return;

      const holeNo = toNumber(holeCell);
      const teeName = norm(row[teeCol]);
      const yards = toNumber(row[yardsCol]);
      const par = toNumber(row[parCol]);
      const strokeIndex = siCol >= 0 ? toNumber(row[siCol]) : null;

      if (holeNo === null) {
        errors.push({ row: sheetRow, message: `Hole number "${holeCell}" is not a number` });
        return;
      }
      if (!teeName) {
        errors.push({ row: sheetRow, message: `Hole ${holeNo}: tee name is blank` });
        return;
      }
      if (yards === null) {
        errors.push({ row: sheetRow, message: `Hole ${holeNo} (${teeName}): yardage is missing or not a number` });
        return;
      }
      if (par === null) {
        errors.push({ row: sheetRow, message: `Hole ${holeNo} (${teeName}): par is missing or not a number` });
        return;
      }

      teeNames.add(teeName);
      const existing = holesByNo.get(holeNo);
      if (!existing) {
        holesByNo.set(holeNo, { holeNo, par, strokeIndex, yards: { [teeName]: yards } });
      } else {
        if (existing.par !== par) {
          errors.push({
            row: sheetRow,
            message: `Hole ${holeNo}: par ${par} for tee "${teeName}" conflicts with par ${existing.par} already seen for this hole`,
          });
        }
        if (strokeIndex !== null && existing.strokeIndex !== null && existing.strokeIndex !== strokeIndex) {
          errors.push({
            row: sheetRow,
            message: `Hole ${holeNo}: stroke index ${strokeIndex} for tee "${teeName}" conflicts with ${existing.strokeIndex} already seen for this hole`,
          });
        }
        existing.yards[teeName] = yards;
        existing.strokeIndex ??= strokeIndex;
      }
    });
  }

  const holes = [...holesByNo.values()].sort((a, b) => a.holeNo - b.holeNo);
  return { layout: 'long', teeNames: [...teeNames], holes, errors };
}

export function parseCourseSheet(sheet: RawSheet): ParseResult {
  const layout = detectLayout(sheet.headers);
  return layout === 'long' ? parseLong(sheet) : parseWide(sheet);
}
