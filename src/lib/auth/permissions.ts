/**
 * Who may change what. Pure decision functions; `guards.ts` loads the rows and
 * calls these.
 *
 * Model: rounds are PRIVATE — a player sees only their own. The admin alone can
 * view other players' rounds (read-only) and the player list. Everyone shares the
 * course library; players can only EDIT their own rounds; and a course/tee is
 * editable by its creator or the admin — with a lock so one player's yardage
 * edit can't change scores on other people's rounds.
 */
export type Actor = { id: string; isAdmin: boolean };

/** Owner always; the admin may look (read-only) at anyone's. Nobody else. */
export function canViewRound(actor: Actor, round: { userId: string | null }): boolean {
  return actor.isAdmin || (round.userId !== null && round.userId === actor.id);
}

export function canEditRound(actor: Actor, round: { userId: string | null }): boolean {
  if (round.userId === null) return actor.isAdmin; // unclaimed legacy row: admin only
  return round.userId === actor.id;
}

/**
 * `otherPlayersOnTee`: at least one round on this tee belongs to someone other
 * than the actor (or to nobody). Editing yardages/par rewrites the meaning of
 * those rounds, so once anyone else has played the tee only the admin may edit.
 */
export function canEditCourse(
  actor: Actor,
  course: { createdByUserId: string | null },
  otherPlayersOnTee: boolean,
): boolean {
  if (actor.isAdmin) return true;
  if (course.createdByUserId !== actor.id) return false;
  return !otherPlayersOnTee;
}
