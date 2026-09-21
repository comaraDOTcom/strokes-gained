import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { parseCourseSheet, type RawSheet } from '@/lib/import/parse-course-sheet';
import { validateParsedStructure } from '@/lib/import/validate-parsed-sheet';
import { requireApiUser, toErrorResponse } from '@/lib/auth/guards';

export async function POST(req: NextRequest) {
  try {
    await requireApiUser();
  } catch (e) {
    return toErrorResponse(e);
  }
  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file uploaded (expected form field "file")' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    return NextResponse.json({ error: 'Could not parse file as .xlsx or .csv' }, { status: 400 });
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return NextResponse.json({ error: 'Workbook has no sheets' }, { status: 400 });
  }
  const sheet = workbook.Sheets[sheetName]!;
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  const [headerRow, ...dataRows] = raw;
  if (!headerRow || headerRow.length === 0) {
    return NextResponse.json({ error: 'Sheet appears to be empty' }, { status: 400 });
  }

  const rawSheet: RawSheet = { headers: headerRow.map((h) => String(h ?? '')), rows: dataRows };
  const result = parseCourseSheet(rawSheet);
  const structuralErrors = validateParsedStructure(result.holes);

  return NextResponse.json({
    layout: result.layout,
    teeNames: result.teeNames,
    holes: result.holes,
    errors: [...result.errors, ...structuralErrors],
    preview: { headers: rawSheet.headers, rows: raw.slice(1, 21) },
  });
}
