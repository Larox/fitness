import { POSE_JOINT_COUNT, type PoseClipBox, type PoseFrame, type PosePoint } from "./joints";

const VIS = 0.5;

function vis(p: PosePoint): boolean {
  return p.visibility >= VIS;
}

function toLocal(p: PosePoint, box: PoseClipBox, pad: number, w: number, h: number): [number, number] {
  const bw = box.x1 - box.x0 || 1;
  const bh = box.y1 - box.y0 || 1;
  const scale = Math.min((w * (1 - 2 * pad)) / bw, (h * (1 - 2 * pad)) / bh);
  const cx = (box.x0 + box.x1) / 2;
  const cy = (box.y0 + box.y1) / 2;
  const x = w / 2 + (p.x - cx) * scale;
  const y = h / 2 + (p.y - cy) * scale;
  return [x, y];
}

function lerpFrame(a: PoseFrame, b: PoseFrame, t: number): PoseFrame {
  const out: PoseFrame = [];
  for (let j = 0; j < POSE_JOINT_COUNT; j++) {
    const pa = a[j]!;
    const pb = b[j]!;
    out.push({
      x: pa.x + (pb.x - pa.x) * t,
      y: pa.y + (pb.y - pa.y) * t,
      z: pa.z + (pb.z - pa.z) * t,
      visibility: Math.min(pa.visibility, pb.visibility),
    });
  }
  return out;
}

export function interpFrames(frames: PoseFrame[], index: number): PoseFrame {
  const n = frames.length;
  if (n === 0) return [];
  const i0 = Math.floor(index) % n;
  const i1 = (i0 + 1) % n;
  const t = index - Math.floor(index);
  return lerpFrame(frames[i0]!, frames[i1]!, t);
}

export interface FigureColors {
  primary: string;
  surface: string;
  track: string;
}

export interface DrawFigureOptions {
  ctx: CanvasRenderingContext2D;
  frame: PoseFrame;
  box: PoseClipBox;
  width: number;
  height: number;
  colors: FigureColors;
  headRadiusNorm: number;
  dpr: number;
}

function line(
  ctx: CanvasRenderingContext2D,
  from: [number, number],
  to: [number, number],
  alpha: number,
) {
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(from[0], from[1]);
  ctx.lineTo(to[0], to[1]);
  ctx.stroke();
}

export function drawStickFigure(opts: DrawFigureOptions): void {
  const { ctx, frame, box, width, height, colors, headRadiusNorm, dpr } = opts;
  const pad = 0.08;
  const lw = 4 * dpr;
  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = colors.primary;
  ctx.fillStyle = colors.primary;

  const pt = (j: number): [number, number] | null => {
    const p = frame[j]!;
    if (!vis(p)) return null;
    return toLocal(p, box, pad, width, height);
  };

  const floorY = (() => {
    let maxY = 0;
    for (const idx of [11, 12, 13, 14]) {
      const p = frame[idx]!;
      if (vis(p)) maxY = Math.max(maxY, toLocal(p, box, pad, width, height)[1]);
    }
    return maxY || height * 0.92;
  })();

  ctx.strokeStyle = colors.track;
  ctx.lineWidth = 3 * dpr;
  ctx.globalAlpha = 1;
  line(ctx, [width * 0.12, floorY], [width * 0.88, floorY], 1);

  ctx.lineWidth = lw;
  ctx.strokeStyle = colors.primary;

  const neck = pt(1);
  const pelvis = pt(2);
  const head = pt(0);
  if (neck && pelvis) line(ctx, neck, pelvis, 1);
  const pickSide = (a: number, b: number) => {
    const pa = frame[a]!;
    const pb = frame[b]!;
    if (Math.abs(pa.z - pb.z) > 0.01) return pa.z > pb.z ? a : b;
    return pa.x < pb.x ? a : b;
  };
  const farWrist = pickSide(7, 8);
  const farElbow = farWrist === 7 ? 5 : 6;
  const nearWrist = farWrist === 7 ? 8 : 7;
  const nearElbow = farWrist === 7 ? 6 : 5;
  const farShoulder = pickSide(3, 4);
  const nearShoulder = farShoulder === 3 ? 4 : 3;

  const pairs: [number, number, number][] = [
    [farShoulder, farElbow, 0.55],
    [farElbow, farWrist, 0.55],
    [nearShoulder, nearElbow, 1],
    [nearElbow, nearWrist, 1],
    [nearShoulder, 1, 1],
    [farShoulder, 1, 0.55],
    [2, 9, 1],
    [9, 11, 1],
    [11, 13, 1],
    [2, 10, 1],
    [10, 12, 1],
    [12, 14, 1],
  ];
  for (const [a, b, alpha] of pairs) {
    const pa = pt(a);
    const pb = pt(b);
    if (pa && pb) line(ctx, pa, pb, alpha);
  }

  const jointDots = [1, 2, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  const jr = 4.5 * dpr;
  for (const j of jointDots) {
    const p = pt(j);
    if (!p) continue;
    ctx.globalAlpha = j === farElbow || j === farWrist || j === farShoulder ? 0.55 : 1;
    ctx.beginPath();
    ctx.arc(p[0], p[1], jr, 0, Math.PI * 2);
    ctx.fill();
  }

  if (head && neck) {
    const [hx, hy] = head;
    const [nx, ny] = neck;
    const d = Math.hypot(hx - nx, hy - ny) || 1;
    const r = Math.max(headRadiusNorm * width, d * 0.9);
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.surface;
    ctx.strokeStyle = colors.primary;
    ctx.beginPath();
    ctx.arc(hx, hy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}