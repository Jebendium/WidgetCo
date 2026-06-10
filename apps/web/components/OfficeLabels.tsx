// Signage and nameplates as DOM overlays — canvas text goes blurry under the
// pixel upscale; CSS text never does (same principle as the speech bubbles).

import { WAYPOINTS, WORLD } from '@/lib/office/waypoints';

const LABELS: { x: number; y: number; text: string }[] = [
  { x: WAYPOINTS.printer.x, y: WAYPOINTS.printer.y + 6, text: 'PRINTER' },
  { x: WAYPOINTS.shredder.x - 8, y: WAYPOINTS.shredder.y + 6, text: 'SHREDDER' },
  { x: WAYPOINTS.kettle.x, y: WAYPOINTS.kettle.y + 12, text: 'KITCHENETTE' },
  { x: WAYPOINTS.meeting_room_1.x, y: WAYPOINTS.meeting_room_1.y + 24, text: 'MEETING RM 1' },
  { x: WAYPOINTS.meeting_room_2.x, y: WAYPOINTS.meeting_room_2.y + 14, text: 'MTG RM 2 (COLD)' },
  { x: WAYPOINTS.ceo_desk.x, y: WAYPOINTS.ceo_desk.y + 10, text: 'GRAHAM' },
  { x: WAYPOINTS.cfo_desk.x, y: WAYPOINTS.cfo_desk.y + 10, text: 'JANET' },
  { x: WAYPOINTS.sales_desk.x, y: WAYPOINTS.sales_desk.y + 10, text: 'TONY' },
  { x: WAYPOINTS.comms_desk.x, y: WAYPOINTS.comms_desk.y + 10, text: 'PRIYA' },
  { x: WAYPOINTS['middle-manager_desk'].x, y: WAYPOINTS['middle-manager_desk'].y + 10, text: 'KEITH' },
  { x: WAYPOINTS.audit_desk.x, y: WAYPOINTS.audit_desk.y + 10, text: 'DEREK' },
];

export function OfficeLabels() {
  return (
    <>
      {LABELS.map((l) => (
        <div
          key={l.text}
          className="office-label"
          style={{ left: `${(l.x / WORLD.width) * 100}%`, top: `${(l.y / WORLD.height) * 100}%` }}
        >
          {l.text}
        </div>
      ))}
    </>
  );
}
