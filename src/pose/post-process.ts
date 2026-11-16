import { POSE_JOINT_COUNT, type PoseClipBox, type PoseFrame, type PosePoint } from "./joints";

const VIS = 0.5;
const MAX_GAP = 3;
const KERNEL = [1, 4, 6, 4, 1];

function visible(p: PosePoint): boolean {
  return p.visibility >= VIS;
}

export function fillGaps(frames: PoseFrame[]): PoseFrame[] {
  const out = frames.map((f) => f.map((p) => ({ ...p })));
  for (let j = 0; j < POSE_JOINT_COUNT; j++) {
    let i = 0;
    while (i < out.length) {
      if (visible(out[i]![j]!)) {
        i += 1;
        continue;
      }
      const gapStart = i;
      while (i < out.length && !visible(out[i]![j]!)) i += 1;
      const gapLen = i - gapStart;
      if (gapLen > MAX_GAP || gapStart === 0 || i >= out.length) continue;
      const before = out[gapStart - 1]![j]!;
      const after = out[i]![j]!;
      for (let k = 0; k < gapLen; k++) {
        const t = (k + 1) / (gapLen + 1);
        out[gapStart + k]![j] = {
          x: before.x + (after.x - before.x) * t,
          y: before.y + (after.y - before.y) * t,
          z: before.z + (after.z - before.z) * t,
          visibility: Math.min(before.visibility, after.visibility),
        };
      }
    }
  }
  return out;
}

export function smoothFrames(frames: PoseFrame[]): PoseFrame[] {
  const half = 2;
  return frames.map((_, fi) => {
    const row: PoseFrame = [];
    for (let j = 0; j < POSE_JOINT_COUNT; j++) {
      let sx = 0;
      let sy = 0;
      let sz = 0;
      let w = 0;
      for (let k = -half; k <= half; k++) {
        const idx = fi + k;
        if (idx < 0 || idx >= frames.length) continue;
        const p = frames[idx]![j]!;
        if (!visible(p)) continue;
        const weight = KERNEL[k + half]!;
        sx += p.x * weight;
        sy += p.y * weight;
        sz += p.z * weight;
        w += weight;
      }
      if (w === 0) {
        row.push({ ...frames[fi]![j]! });
      } else {
        row.push({
          x: sx / w,
          y: sy / w,
          z: sz / w,
          visibility: frames[fi]![j]!.visibility,
        });
      }
    }
    return row;
  });
}

export function blendLoopSeam(frames: PoseFrame[]): PoseFrame[] {
  if (frames.length < 2) return frames;
  const first = frames[0]!;
  const last = frames[frames.length - 1]!;
  let dist = 0;
  let count = 0;
  for (let j = 0; j < POSE_JOINT_COUNT; j++) {
    if (visible(first[j]!) && visible(last[j]!)) {
      dist += Math.hypot(first[j]!.x - last[j]!.x, first[j]!.y - last[j]!.y);
      count += 1;
    }
  }
  const box = unionBox(frames);
  const diag = Math.hypot(box.x1 - box.x0, box.y1 - box.y0) || 1;
  if (count === 0 || dist / count <= 0.03 * diag) {
    return frames.map((f) => f.map((p) => ({ ...p })));
  }
  const out = frames.map((f) => f.map((p) => ({ ...p })));
  const tail = Math.min(8, out.length);
  for (let k = 0; k < tail; k++) {
    const idx = out.length - tail + k;
    const t = (k + 1) / 8;
    for (let j = 0; j < POSE_JOINT_COUNT; j++) {
      const a = out[idx]![j]!;
      const b = first[j]!;
      if (!visible(a) || !visible(b)) continue;
      out[idx]![j] = {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t,
        visibility: a.visibility,
      };
    }
  }
  return out;
}

export function unionBox(frames: PoseFrame[]): PoseClipBox {
  let x0 = 1;
  let y0 = 1;
  let x1 = 0;
  let y1 = 0;
  let any = false;
  for (const frame of frames) {
    for (const p of frame) {
      if (!visible(p)) continue;
      any = true;
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    }
  }
  if (!any) {
    return { x0: 0, y0: 0, x1: 1, y1: 1 };
  }
  return { x0, y0, x1, y1 };
}

export function pickKeyFrame(frames: PoseFrame[]): number {
  const means: PosePoint[] = [];
  for (let j = 0; j < POSE_JOINT_COUNT; j++) {
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (const frame of frames) {
      const p = frame[j]!;
      if (!visible(p)) continue;
      sx += p.x;
      sy += p.y;
      n += 1;
    }
    means[j] = { x: n ? sx / n : 0, y: n ? sy / n : 0, z: 0, visibility: n ? 1 : 0 };
  }
  let best = 0;
  let bestScore = -1;
  for (let fi = 0; fi < frames.length; fi++) {
    let score = 0;
    let n = 0;
    for (let j = 0; j < POSE_JOINT_COUNT; j++) {
      const p = frames[fi]![j]!;
      const m = means[j]!;
      if (!visible(p) || !m.visibility) continue;
      score += Math.hypot(p.x - m.x, p.y - m.y);
      n += 1;
    }
    const avg = n ? score / n : 0;
    if (avg > bestScore) {
      bestScore = avg;
      best = fi;
    }
  }
  return best;
}

export function headRadiusMedian(frames: PoseFrame[]): number {
  const dists: number[] = [];
  for (const frame of frames) {
    const head = frame[0]!;
    const neck = frame[1]!;
    if (!visible(head) || !visible(neck)) continue;
    dists.push(Math.hypot(head.x - neck.x, head.y - neck.y));
  }
  if (dists.length === 0) return 0.08;
  dists.sort((a, b) => a - b);
  const mid = dists[Math.floor(dists.length / 2)]!;
  return 0.55 * mid;
}