// Shared sanitizer for customer bedding selections relayed through the BFF.
//
// The frontend sends `{ room_index, selected }` per allocated room. Only those
// two fields are forwarded to InnPilot: any financial value a client injects
// (chargePerNight, bedding_total, amount, ...) is dropped. InnPilot remains the
// only authority on what is charged.

export function sanitizeBeddingSelections(value) {
  if (!Array.isArray(value)) return undefined;
  const out = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const roomIndex = Number(item.room_index);
    if (!Number.isInteger(roomIndex) || roomIndex < 0 || roomIndex > 11) continue;
    out.push({ room_index: roomIndex, selected: !!item.selected });
  }
  return out.length > 0 ? out : undefined;
}
