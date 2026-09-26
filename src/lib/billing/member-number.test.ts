import { describe, expect, it } from 'vitest';
import { formatMemberNo, isFoundingMember } from './member-number';

describe('member numbers', () => {
  it('pads to four digits on the card', () => {
    expect(formatMemberNo(1)).toBe('0001');
    expect(formatMemberNo(42)).toBe('0042');
    expect(formatMemberNo(12345)).toBe('12345');
  });

  it('members 1 to 100 are founding members; 101 and no number are not', () => {
    expect(isFoundingMember(1)).toBe(true);
    expect(isFoundingMember(100)).toBe(true);
    expect(isFoundingMember(101)).toBe(false);
    expect(isFoundingMember(null)).toBe(false);
  });
});
