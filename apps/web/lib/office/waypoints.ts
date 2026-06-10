// Fixed named coordinates in the office. No pathfinding — agents increment
// toward a waypoint at fixed speed; walking through desks is canon, not a bug.
// Coordinates are in world pixels on a 480x320 canvas (scaled up, pixelated).

export interface Waypoint {
  x: number;
  y: number;
}

// (Waypoints are shared by the canvas; the sim's session windows live in
// sim/lib/theatre.ts.)
// Coordinates map onto the LimeZu Office_Design_2 background, widened to
// 960x544 with exterior ground (the building sits 224px in from the left).
export const WORLD = { width: 1344, height: 544 } as const;
const BX = 320; // building x-offset (building is 704 wide after the band dup)
const D = 192; // shift applied to original features right of the duplicated band

export const WAYPOINTS = {
  ceo_desk: { x: BX + 128, y: 162 }, // row 1 cubicles, now five across
  cfo_desk: { x: BX + 224, y: 162 },
  sales_desk: { x: BX + 320 + D, y: 162 },
  comms_desk: { x: BX + 224, y: 210 }, // row 2 cubicles
  'middle-manager_desk': { x: BX + 416, y: 210 },
  audit_desk: { x: BX + 408 + D, y: 452 }, // the back workshop room
  printer: { x: BX + 446 + D, y: 130 },
  shredder: { x: BX + 466 + D, y: 478 },
  meeting_room_1: { x: BX + 252, y: 420 }, // the lounge with the unexplained crates
  meeting_room_2: { x: BX + 160, y: 470 }, // the cold end of it
  kettle: { x: BX + 322 + D, y: 372 }, // the water cooler corner
  door: { x: BX + 24, y: 300 },
} as const;

export type WaypointName = keyof typeof WAYPOINTS;

/** Each agent's home desk; unknown agents start at the door, as is proper. */
export function deskOf(agentId: string): Waypoint {
  const table: Record<string, Waypoint> = WAYPOINTS;
  return table[`${agentId}_desk`] ?? WAYPOINTS.door;
}
