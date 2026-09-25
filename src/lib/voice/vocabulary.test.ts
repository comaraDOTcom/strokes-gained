import { describe, it, expect } from 'vitest';
import { fixGolfWords, normaliseSpokenNumbers } from './vocabulary';

const fixed = (s: string) => fixGolfWords(s).text;

describe('fixGolfWords — the errors a real phone actually made', () => {
  // Captured on an iPhone, reading the three example phrases aloud in one go. Every word error
  // below is a near-homophone of a golf term; every number came back correct.
  const REAL =
    'Driving to the left of 150 was left an eight hour to 20 feet then two pots ' +
    'I drove it 250 on the fairway of seven iron to 15 feet one foot ' +
    'I hit my T-shirt into the bunker spot at 40 hours wedge 6 feet hold it';

  it('repairs every misheard golf word in that transcript', () => {
    const out = fixed(REAL);
    expect(out).toContain('eight iron'); // "eight hour"
    expect(out).toContain('two putts'); // "two pots"
    expect(out).toContain('one putt'); // "one foot"
    expect(out).toContain('tee shot'); // "T-shirt"
    expect(out).toContain('40 yards'); // "40 hours"
    expect(out).toContain('holed it'); // "hold it"
  });

  it('leaves every number exactly as it was heard', () => {
    const numbers = (s: string) => s.match(/\d+/g) ?? [];
    expect(numbers(fixed(REAL))).toEqual(numbers(REAL));
  });

  it('reports what it changed, so nothing is silently rewritten', () => {
    const { fixes } = fixGolfWords(REAL);
    expect(fixes.map((f) => f.to)).toEqual(
      expect.arrayContaining(['tee shot', 'holed it', 'putts', 'eight iron', '40 yards', 'one putt']),
    );
  });
});

describe('fixGolfWords — knowing when to leave well alone', () => {
  it('keeps a real distance in feet', () => {
    expect(fixed('wedge to one foot')).toBe('wedge to one foot');
    expect(fixed('inside three foot')).toBe('inside three foot');
    expect(fixed('chip to six feet')).toBe('chip to six feet');
  });

  it('tells a club from a distance when fixing "hours"', () => {
    expect(fixed('eight hour to the green')).toContain('eight iron');
    expect(fixed('150 hours out')).toContain('150 yards');
    expect(fixed('seven hours')).toContain('seven iron');
  });

  it('leaves a sentence with no golf mishearings untouched', () => {
    const clean = 'Driver into the left rough, 150 left, eight iron to twenty feet, two putts';
    expect(fixGolfWords(clean).fixes).toEqual([]);
  });

  it('fixes the classic wedge mishearing', () => {
    expect(fixed('sandwich out to 20 feet')).toContain('sand wedge');
  });
});

describe('normaliseSpokenNumbers', () => {
  it('writes spoken distances as digits', () => {
    expect(normaliseSpokenNumbers('one fifty to the pin')).toBe('150 to the pin');
    expect(normaliseSpokenNumbers('two twenty five off the tee')).toBe('225 off the tee');
    expect(normaliseSpokenNumbers('a hundred and forty')).toBe('140');
    expect(normaliseSpokenNumbers('one hundred fifty')).toBe('150');
  });

  it('leaves small counts alone — "two putts" is not 220', () => {
    expect(normaliseSpokenNumbers('two putts')).toBe('two putts');
    expect(normaliseSpokenNumbers('eight iron')).toBe('eight iron');
  });
});
