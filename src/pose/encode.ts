import { POSE_JOINT_COUNT, POSE_JOINT_NAMES, type PoseClipHeader, type PoseFrame } from "./joints";

function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function encodePoseClip(header: PoseClipHeader, frames: PoseFrame[]): Blob {
  const headerJson = JSON.stringify({
    ...header,
    joints: POSE_JOINT_NAMES,
  });
  const headerBytes = encodeUtf8(headerJson);
  const headerLen = headerBytes.length;
  const frameCount = frames.length;
  const total = 4 + headerLen + frameCount * POSE_JOINT_COUNT * 2 * 2 + frameCount * POSE_JOINT_COUNT;
  const buf = new ArrayBuffer(total);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  view.setUint32(0, headerLen, true);
  bytes.set(headerBytes, 4);
  let offset = 4 + headerLen;
  for (const frame of frames) {
    for (let j = 0; j < POSE_JOINT_COUNT; j++) {
      const p = frame[j]!;
      const x = Math.round(Math.min(1, Math.max(0, p.x)) * 65535);
      const y = Math.round(Math.min(1, Math.max(0, p.y)) * 65535);
      view.setUint16(offset, x, true);
      offset += 2;
      view.setUint16(offset, y, true);
      offset += 2;
    }
  }
  for (const frame of frames) {
    for (let j = 0; j < POSE_JOINT_COUNT; j++) {
      const v = Math.round(Math.min(1, Math.max(0, frame[j]!.visibility)) * 255);
      bytes[offset] = v;
      offset += 1;
    }
  }
  return new Blob([buf], { type: "application/vnd.fitness.pose" });
}

export interface DecodedPoseClip {
  header: PoseClipHeader;
  frames: PoseFrame[];
}

export function decodePoseClip(blob: ArrayBuffer): DecodedPoseClip {
  const view = new DataView(blob);
  const headerLen = view.getUint32(0, true);
  const headerBytes = new Uint8Array(blob, 4, headerLen);
  const header = JSON.parse(new TextDecoder().decode(headerBytes)) as PoseClipHeader;
  let offset = 4 + headerLen;
  const frames: PoseFrame[] = [];
  for (let fi = 0; fi < header.frames; fi++) {
    const frame: PoseFrame = [];
    for (let j = 0; j < POSE_JOINT_COUNT; j++) {
      const x = view.getUint16(offset, true) / 65535;
      offset += 2;
      const y = view.getUint16(offset, true) / 65535;
      offset += 2;
      frame.push({ x, y, z: 0, visibility: 0 });
    }
    frames.push(frame);
  }
  for (let fi = 0; fi < header.frames; fi++) {
    for (let j = 0; j < POSE_JOINT_COUNT; j++) {
      const v = new Uint8Array(blob, offset, 1)[0]! / 255;
      offset += 1;
      frames[fi]![j]!.visibility = v;
    }
  }
  return { header, frames };
}