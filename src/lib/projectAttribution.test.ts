import { describe, it, expect } from "vitest";
import {
  groupAssignmentsByPlantItem,
  projectForItemAt,
  type AssignmentWindow,
} from "./projectAttribution";

const ITEM = "plant-1";
const P_OLD = "project-old";
const P_NEW = "project-new";
const MOVE_AT = "2026-04-15T10:00:00.000Z";

function buildHistory(): Record<string, AssignmentWindow[]> {
  // Item was on P_OLD from Apr 1 → moved to P_NEW on Apr 15 10:00 UTC.
  return groupAssignmentsByPlantItem([
    { plant_item_id: ITEM, project_id: P_OLD, assigned_at: "2026-04-01T00:00:00.000Z", removed_at: MOVE_AT },
    { plant_item_id: ITEM, project_id: P_NEW, assigned_at: MOVE_AT, removed_at: null },
  ]);
}

describe("projectForItemAt — time-aware attribution", () => {
  const history = buildHistory();

  it("attributes a delivery BEFORE the move to the OLD project", () => {
    expect(projectForItemAt(history, ITEM, "2026-04-10T08:30:00.000Z")).toBe(P_OLD);
  });

  it("attributes a delivery AT the exact move timestamp to the NEW project", () => {
    // Window is [assigned_at, removed_at) — the boundary belongs to the new window.
    expect(projectForItemAt(history, ITEM, MOVE_AT)).toBe(P_NEW);
  });

  it("attributes a delivery AFTER the move to the NEW project", () => {
    expect(projectForItemAt(history, ITEM, "2026-04-20T14:00:00.000Z")).toBe(P_NEW);
  });

  it("attributes a delivery one millisecond BEFORE the move to the OLD project", () => {
    expect(projectForItemAt(history, ITEM, "2026-04-15T09:59:59.999Z")).toBe(P_OLD);
  });

  it("falls back to the earliest assignment for historical deliveries that predate all windows", () => {
    expect(projectForItemAt(history, ITEM, "2025-12-01T00:00:00.000Z")).toBe(P_OLD);
  });

  it("returns undefined for unknown plant items", () => {
    expect(projectForItemAt(history, "unknown", "2026-04-20T00:00:00.000Z")).toBeUndefined();
    expect(projectForItemAt(history, undefined, "2026-04-20T00:00:00.000Z")).toBeUndefined();
  });

  it("returns undefined when the item has been unassigned (closed window, no replacement)", () => {
    const closed = groupAssignmentsByPlantItem([
      { plant_item_id: ITEM, project_id: P_OLD, assigned_at: "2026-04-01T00:00:00.000Z", removed_at: MOVE_AT },
    ]);
    // A delivery AFTER the close should NOT carry over to the now-removed project.
    expect(projectForItemAt(closed, ITEM, "2026-04-20T00:00:00.000Z")).toBeUndefined();
    // A delivery DURING the window still attributes correctly.
    expect(projectForItemAt(closed, ITEM, "2026-04-10T00:00:00.000Z")).toBe(P_OLD);
  });

  it("handles multiple sequential moves correctly", () => {
    const P_THIRD = "project-third";
    const SECOND_MOVE = "2026-04-25T12:00:00.000Z";
    const multi = groupAssignmentsByPlantItem([
      { plant_item_id: ITEM, project_id: P_OLD, assigned_at: "2026-04-01T00:00:00.000Z", removed_at: MOVE_AT },
      { plant_item_id: ITEM, project_id: P_NEW, assigned_at: MOVE_AT, removed_at: SECOND_MOVE },
      { plant_item_id: ITEM, project_id: P_THIRD, assigned_at: SECOND_MOVE, removed_at: null },
    ]);
    expect(projectForItemAt(multi, ITEM, "2026-04-10T00:00:00.000Z")).toBe(P_OLD);
    expect(projectForItemAt(multi, ITEM, "2026-04-20T00:00:00.000Z")).toBe(P_NEW);
    expect(projectForItemAt(multi, ITEM, "2026-04-26T00:00:00.000Z")).toBe(P_THIRD);
  });

  it("is order-independent — input rows in any order produce the same result", () => {
    const reversed = groupAssignmentsByPlantItem([
      { plant_item_id: ITEM, project_id: P_NEW, assigned_at: MOVE_AT, removed_at: null },
      { plant_item_id: ITEM, project_id: P_OLD, assigned_at: "2026-04-01T00:00:00.000Z", removed_at: MOVE_AT },
    ]);
    expect(projectForItemAt(reversed, ITEM, "2026-04-10T00:00:00.000Z")).toBe(P_OLD);
    expect(projectForItemAt(reversed, ITEM, "2026-04-20T00:00:00.000Z")).toBe(P_NEW);
  });
});