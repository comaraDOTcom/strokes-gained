import { describe, expect, it } from 'vitest';
import { parseSessionEntry } from './entry';

const TODAY = '2026-09-26';

describe('parseSessionEntry', () => {
  it('accepts a real drill, date and score', () => {
    expect(parseSessionEntry({ practisedOn: '2026-09-25', drillId: 'circle-putting', score: 16 }, TODAY)).toEqual({
      ok: true,
      practisedOn: '2026-09-25',
      drillId: 'circle-putting',
      score: 16,
    });
    expect(parseSessionEntry({ practisedOn: TODAY, drillId: 'lag-putting', score: 0 }, TODAY).ok).toBe(true);
  });

  it('rejects anything else with a message a player can act on', () => {
    const bad = (body: unknown) => {
      const r = parseSessionEntry(body, TODAY);
      return r.ok ? null : r.error;
    };
    expect(bad(null)).toMatch(/object/);
    expect(bad({ practisedOn: TODAY, drillId: 'blocked-range-session', score: 5 })).toMatch(/drill/);
    expect(bad({ practisedOn: '26/09/2026', drillId: 'circle-putting', score: 5 })).toMatch(/YYYY-MM-DD/);
    expect(bad({ practisedOn: '2026-02-30', drillId: 'circle-putting', score: 5 })).toMatch(/YYYY-MM-DD/);
    expect(bad({ practisedOn: '2026-09-27', drillId: 'circle-putting', score: 5 })).toMatch(/hasn't happened/);
    expect(bad({ practisedOn: '1999-12-31', drillId: 'circle-putting', score: 5 })).toMatch(/too far back/);
    expect(bad({ practisedOn: TODAY, drillId: 'circle-putting', score: 21 })).toBe('Score must be a whole number from 0 to 20.');
    expect(bad({ practisedOn: TODAY, drillId: 'circle-putting', score: -1 })).toMatch(/0 to 20/);
    expect(bad({ practisedOn: TODAY, drillId: 'circle-putting', score: 15.5 })).toMatch(/whole number/);
    expect(bad({ practisedOn: TODAY, drillId: 'circle-putting', score: '16' })).toMatch(/whole number/);
  });
});
