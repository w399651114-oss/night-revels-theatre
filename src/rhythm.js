// 声音缓冲和击槌共用这张节奏表。落点在拍头，第六个八分脉冲休止。
export const drumStep = 0.375;
export function drumHit(beat) {
  return ((beat % 8) + 8) % 8 !== 5;
}
export function drumPose(phase) {
  const beat = Math.floor(phase / drumStep);
  const part = phase / drumStep - beat;
  if (part < 0.35 && drumHit(beat)) return (1 - part / 0.35) ** 2;
  if (part > 0.72 && drumHit(beat + 1)) return ((part - 0.72) / 0.28) ** 2;
  return 0;
}
