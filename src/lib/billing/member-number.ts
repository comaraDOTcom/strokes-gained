/** How a member number appears on the Member's card, and who counts as a founding member. */

/** Cards 1 to FOUNDING_MEMBERS say "Founding member", for good. */
export const FOUNDING_MEMBERS = 100;

export function isFoundingMember(memberNo: number | null): boolean {
  return memberNo !== null && memberNo >= 1 && memberNo <= FOUNDING_MEMBERS;
}

/** 42 -> "0042". Four digits until we pass 9999, then as many as it needs. */
export function formatMemberNo(memberNo: number): string {
  return String(memberNo).padStart(4, '0');
}
