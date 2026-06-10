// Fixed named coordinates in the office. No pathfinding — agents increment
// toward a waypoint at fixed speed; walking through desks is canon, not a bug.
// Coordinates are in world pixels on a 480x320 canvas (scaled up, pixelated).

export interface Waypoint {
  x: number;
  y: number;
}

export const WORLD = { width: 480, height: 320 } as const;

export const WAYPOINTS = {
  ceo_desk: { x: 80, y: 70 },
  cfo_desk: { x: 200, y: 70 },
  sales_desk: { x: 320, y: 70 },
  comms_desk: { x: 80, y: 190 },
  'middle-manager_desk': { x: 200, y: 190 },
  audit_desk: { x: 410, y: 250 }, // slightly apart, for independence
  printer: { x: 410, y: 60 },
  shredder: { x: 440, y: 150 }, // the corridor outside Finance
  meeting_room_1: { x: 320, y: 250 },
  meeting_room_2: { x: 60, y: 280 }, // the original Soames shed; the cold one
  kettle: { x: 240, y: 280 },
  door: { x: 20, y: 160 },
} as const;

export type WaypointName = keyof typeof WAYPOINTS;

/** Each agent's home desk; unknown agents start at the door, as is proper. */
export function deskOf(agentId: string): Waypoint {
  const table: Record<string, Waypoint> = WAYPOINTS;
  return table[`${agentId}_desk`] ?? WAYPOINTS.door;
}
