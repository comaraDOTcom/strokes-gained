/**
 * Who may change what. Pure decision functions; `guards.ts` loads the rows and
 * calls these.
 *
 * Model: every signed-in user can VIEW every round (read-only) and the shared
 * course library; they can only EDIT their own rounds; and a course/tee is
 * editable by its creator or the admin — with a lock so one player's yardage
 * edit can't change scores on other people's rounds.
 */
export type Actor = { id: string; isAdmin: boolean };

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
