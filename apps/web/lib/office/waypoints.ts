// Fixed named coordinates in the office. No pathfinding — agents increment
// toward a waypoint at fixed speed; walking through desks is canon, not a bug.
// Coordinates are in world pixels on a 480x320 canvas (scaled up, pixelated).

export interface Waypoint {
  x: number;
  y: number;
}

// Coordinates map onto the LimeZu Office_Design_2 background, widened to
// 960x544 with exterior ground (the building sits 224px in from the left).
export const WORLD = { width: 1344, height: 544 } as const;
const BX = 416; // building x-offset within the widened world

export const WAYPOINTS = {
  ceo_desk: { x: BX + 128, y: 162 }, // row 1 cubicles
  cfo_desk: { x: BX + 224, y: 162 },
  sales_desk: { x: BX + 320, y: 162 },
  comms_desk: { x: BX + 128, y: 210 }, // row 2 cubicles
  'middle-manager_desk': { x: BX + 224, y: 210 },
  audit_desk: { x: BX + 408, y: 452 }, // the back workshop room, for independence
  printer: { x: BX + 446, y: 130 },
  shredder: { x: BX + 466, y: 478 }, // by the workshop bench, outside Finance
  meeting_room_1: { x: BX + 252, y: 420 }, // the lounge with the unexplained crates
  meeting_room_2: { x: BX + 160, y: 470 }, // the cold end of it
  kettle: { x: BX + 322, y: 372 }, // the water cooler corner
  door: { x: BX + 24, y: 300 },
} as const;

export type WaypointName = keyof typeof WAYPOINTS;

/** Each agent's home desk; unknown agents start at the door, as is proper. */
export function deskOf(agentId: string): Waypoint {
  const table: Record<string, Waypoint> = WAYPOINTS;
  return table[`${agentId}_desk`] ?? WAYPOINTS.door;
}
