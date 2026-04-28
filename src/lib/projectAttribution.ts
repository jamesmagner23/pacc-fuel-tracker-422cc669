/**
 * Pure helpers for time-aware plant → project attribution.
 *
 * A plant item's project history is stored as a list of assignment windows:
 *   { project_id, assigned_at, removed_at? }
 *
 * Given a delivery timestamp, we resolve which project the item belonged to
 * at that moment so deliveries before a drag-and-drop move stay with the
 * old project and deliveries after the move belong to the new one.
 */

export interface AssignmentWindow {
  project_id: string;
  assigned_at: string;        // ISO timestamp
  removed_at: string | null;  // ISO timestamp or null when still active
}

/**
 * Group flat assignment rows by plant_item_id and sort each group ascending
 * by assigned_at for deterministic lookup.
 */
export function groupAssignmentsByPlantItem(
  assignments: Array<AssignmentWindow & { plant_item_id: string }>
): Record<string, AssignmentWindow[]> {
  const out: Record<string, AssignmentWindow[]> = {};
  for (const a of assignments) {
    (out[a.plant_item_id] ||= []).push({
      project_id: a.project_id,
      assigned_at: a.assigned_at,
      removed_at: a.removed_at,
    });
  }
  Object.values(out).forEach((list) =>
    list.sort((x, y) => (x.assigned_at < y.assigned_at ? -1 : 1))
  );
  return out;
}

/**
 * Resolve the project id that owns a given plant item at the given moment.
 *
 * Rules:
 *  - Returns the assignment whose [assigned_at, removed_at) window contains the timestamp.
 *  - removed_at = null means the assignment is still open.
 *  - If no window matches AND the timestamp is BEFORE every recorded window,
 *    returns the earliest assignment (covers historical data synced before tagging).
 *  - If no window matches AND the timestamp is AFTER every removed window,
 *    returns undefined (item is currently unassigned).
 */
export function projectForItemAt(
  itemAssignments: Record<string, AssignmentWindow[]>,
  itemId: string | undefined,
  isoDate: string | null | undefined
): string | undefined {
  if (!itemId) return undefined;
  const list = itemAssignments[itemId];
  if (!list || !list.length) return undefined;
  const ts = isoDate || new Date().toISOString();

  for (const a of list) {
    if (a.assigned_at <= ts && (a.removed_at === null || ts < a.removed_at)) {
      return a.project_id;
    }
  }

  // Historical fallback: timestamp predates the earliest known assignment.
  if (ts < list[0].assigned_at) return list[0].project_id;

  // Otherwise the item is currently unassigned.
  return undefined;
}