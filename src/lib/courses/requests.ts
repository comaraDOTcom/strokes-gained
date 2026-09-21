/** Validation for "request a course". Pure, so the limits are unit-tested. */
export const MAX_REQUEST_NAME = 120;
export const MAX_REQUEST_DETAILS = 1000;
/** A player can have this many unanswered requests at once (stops the inbox being flooded). */
export const MAX_OPEN_REQUESTS_PER_USER = 5;

export type ParsedCourseRequest =
  | { ok: true; courseName: string; details: string | null }
  | { ok: false; error: string };

export function parseCourseRequest(body: unknown): ParsedCourseRequest {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Body must be a JSON object' };
  }
  const { courseName, details } = body as Record<string, unknown>;
  if (typeof courseName !== 'string' || courseName.trim().length < 3) {
    return { ok: false, error: 'Tell us the course name (at least 3 characters).' };
  }
  if (courseName.trim().length > MAX_REQUEST_NAME) {
    return { ok: false, error: `Course name must be at most ${MAX_REQUEST_NAME} characters.` };
  }
  if (details !== undefined && details !== null && typeof details !== 'string') {
    return { ok: false, error: 'details must be text' };
  }
  const d = typeof details === 'string' ? details.trim() : '';
  if (d.length > MAX_REQUEST_DETAILS) {
    return { ok: false, error: `Details must be at most ${MAX_REQUEST_DETAILS} characters.` };
  }
  return { ok: true, courseName: courseName.trim(), details: d === '' ? null : d };
}
