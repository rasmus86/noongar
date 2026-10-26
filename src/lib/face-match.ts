import type { Guest } from "@/lib/guests";

export type FaceDescriptor = Float32Array;

type FaceApiModule = typeof import("@vladmandic/face-api");

const LOCAL_MODEL_URL = "/models/face-api";
const CDN_MODEL_URL =
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model";

/** Distancia euclídea FaceNet: <0.6 suele ser la misma persona (LFW). */
export const MATCH_THRESHOLD = 0.58;
/** Umbral un poco más laxo si la cara es pequeña (reconocimiento a metros). */
export const MATCH_THRESHOLD_DISTANCE = 0.62;

/** Cara en check-in (cerca): % mínimo del lado corto del frame. */
export const MIN_FACE_RATIO = 0.22;
/** Cara en planta (lejos): aceptamos caras mucho más pequeñas. */
export const MIN_FACE_RATIO_DISTANCE = 0.04;

export type DetectMode = "enroll" | "distance";

let faceapiPromise: Promise<FaceApiModule> | null = null;
let modelsReady = false;
let modelsLoading: Promise<void> | null = null;
let lastLoadError: string | null = null;

async function getFaceApi(): Promise<FaceApiModule> {
  if (!faceapiPromise) {
    faceapiPromise = import("@vladmandic/face-api/dist/face-api.esm.js");
  }
  return faceapiPromise;
}

async function loadAllNets(faceapi: FaceApiModule, baseUrl: string) {
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(baseUrl),
    faceapi.nets.faceLandmark68Net.loadFromUri(baseUrl),
    faceapi.nets.faceRecognitionNet.loadFromUri(baseUrl),
  ]);
}

export function getFaceModelLoadError(): string | null {
  return lastLoadError;
}

export async function ensureFaceModels(): Promise<void> {
  if (modelsReady) return;
  if (!modelsLoading) {
    modelsLoading = (async () => {
      const faceapi = await getFaceApi();
      const tf = faceapi.tf as unknown as {
        setBackend?: (b: string) => Promise<boolean>;
        ready?: () => Promise<void>;
      };
      try {
        await tf.setBackend?.("webgl");
        await tf.ready?.();
      } catch {
        await tf.setBackend?.("cpu");
        await tf.ready?.();
      }

      try {
        await loadAllNets(faceapi, LOCAL_MODEL_URL);
      } catch (localErr) {
        try {
          await loadAllNets(faceapi, CDN_MODEL_URL);
        } catch (cdnErr) {
          const localMsg =
            localErr instanceof Error ? localErr.message : String(localErr);
          const cdnMsg =
            cdnErr instanceof Error ? cdnErr.message : String(cdnErr);
          lastLoadError = `Local: ${localMsg} · CDN: ${cdnMsg}`;
          throw new Error(lastLoadError);
        }
      }
      lastLoadError = null;
      modelsReady = true;
    })().catch((err) => {
      modelsLoading = null;
      throw err;
    });
  }
  await modelsLoading;
}

export function areFaceModelsReady(): boolean {
  return modelsReady;
}

export type DetectedFace = {
  descriptor: FaceDescriptor;
  box: { x: number; y: number; width: number; height: number };
  score: number;
  /** true si se usó zoom digital / ROI ampliado */
  boosted?: boolean;
};

function frameSize(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
): { w: number; h: number } {
  if (input instanceof HTMLVideoElement) {
    return { w: input.videoWidth, h: input.videoHeight };
  }
  if (input instanceof HTMLImageElement) {
    return { w: input.naturalWidth || input.width, h: input.naturalHeight || input.height };
  }
  return { w: input.width, h: input.height };
}

function toDetected(
  result: {
    descriptor: Float32Array;
    detection: { box: { x: number; y: number; width: number; height: number }; score: number };
  },
  boosted = false,
): DetectedFace {
  const box = result.detection.box;
  return {
    descriptor: result.descriptor,
    box: { x: box.x, y: box.y, width: box.width, height: box.height },
    score: result.detection.score,
    boosted,
  };
}

async function detectOnInput(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  mode: DetectMode,
): Promise<DetectedFace | null> {
  const faceapi = await getFaceApi();
  await ensureFaceModels();

  const options = new faceapi.TinyFaceDetectorOptions(
    mode === "distance"
      ? { inputSize: 608, scoreThreshold: 0.28 }
      : { inputSize: 416, scoreThreshold: 0.45 },
  );

  const results = await faceapi
    .detectAllFaces(input, options)
    .withFaceLandmarks()
    .withFaceDescriptors();

  if (!results.length) return null;
  // Cara más grande = mejor candidata en pasillo/recepción
  results.sort(
    (a, b) =>
      b.detection.box.width * b.detection.box.height -
      a.detection.box.width * a.detection.box.height,
  );
  return toDetected(results[0], false);
}

/**
 * Zoom digital centrado: amplía el centro del frame para caras lejanas.
 * Devuelve descriptor + caja remapeada al frame original.
 */
async function detectWithDigitalZoom(
  video: HTMLVideoElement,
): Promise<DetectedFace | null> {
  const { w, h } = frameSize(video);
  if (!w || !h) return null;

  // Recortes progresivos: 70% → 50% → 35% del frame (más "tele")
  const scales = [0.7, 0.5, 0.35];
  for (const scale of scales) {
    const cw = Math.floor(w * scale);
    const ch = Math.floor(h * scale);
    const sx = Math.floor((w - cw) / 2);
    const sy = Math.floor((h - ch) / 2);
    const canvas = document.createElement("canvas");
    // Upscale a ~960 para dar más píxeles a TinyFaceDetector
    const outW = 960;
    const outH = Math.round((ch / cw) * outW);
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(video, sx, sy, cw, ch, 0, 0, outW, outH);

    const face = await detectOnInput(canvas, "distance");
    if (!face) continue;

    const scaleX = cw / outW;
    const scaleY = ch / outH;
    return {
      ...face,
      box: {
        x: sx + face.box.x * scaleX,
        y: sy + face.box.y * scaleY,
        width: face.box.width * scaleX,
        height: face.box.height * scaleY,
      },
      boosted: true,
    };
  }
  return null;
}

async function detectFaceFull(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  mode: DetectMode = "enroll",
): Promise<DetectedFace | null> {
  const face = await detectOnInput(input, mode);
  if (mode !== "distance") return face;

  const { w, h } = frameSize(input);
  const shortSide = Math.min(w, h) || 1;
  if (face) {
    const ratio = Math.min(face.box.width, face.box.height) / shortSide;
    // Cara ya razonable → no hace falta zoom
    if (ratio >= MIN_FACE_RATIO_DISTANCE * 2) return face;
  }

  // Solo zoom digital sobre vídeo (planta)
  if (input instanceof HTMLVideoElement) {
    const zoomed = await detectWithDigitalZoom(input);
    if (zoomed) return zoomed;
  }
  return face;
}

export type FaceQuality = {
  ok: boolean;
  reasons: string[];
  faceRatio: number;
  score: number;
};

export type EnrollRange = "near" | "far";

/** Cara lejana en check-in: alejada pero aún usable (~1–2 m con webcam). */
export const MIN_FACE_RATIO_FAR_ENROLL = 0.055;
export const MAX_FACE_RATIO_FAR_ENROLL = 0.16;

export function assessFaceQuality(
  face: DetectedFace,
  frameW: number,
  frameH: number,
  range: EnrollRange = "near",
): FaceQuality {
  const reasons: string[] = [];
  const shortSide = Math.min(frameW, frameH) || 1;
  const faceRatio = Math.min(face.box.width, face.box.height) / shortSide;

  if (range === "near") {
    if (face.score < 0.5) {
      reasons.push("Low-confidence detection: look at the camera.");
    }
    if (faceRatio < MIN_FACE_RATIO) {
      reasons.push("Move closer (face should fill more of the frame).");
    }
    const cx = face.box.x + face.box.width / 2;
    const cy = face.box.y + face.box.height / 2;
    if (
      cx < frameW * 0.2 ||
      cx > frameW * 0.8 ||
      cy < frameH * 0.15 ||
      cy > frameH * 0.85
    ) {
      reasons.push("Centra la cara en el cuadro.");
    }
  } else {
    if (face.score < 0.32) {
      reasons.push("Face unclear at distance. Improve lighting and look this way.");
    }
    if (faceRatio > MAX_FACE_RATIO_FAR_ENROLL) {
      reasons.push("Step back a little more (1–2 steps).");
    } else if (faceRatio < MIN_FACE_RATIO_FAR_ENROLL) {
      reasons.push("Too far — move a little closer.");
    }
    const cx = face.box.x + face.box.width / 2;
    const cy = face.box.y + face.box.height / 2;
    if (
      cx < frameW * 0.12 ||
      cx > frameW * 0.88 ||
      cy < frameH * 0.08 ||
      cy > frameH * 0.92
    ) {
      reasons.push("Keep the face more centred in the corridor/frame.");
    }
  }

  return {
    ok: reasons.length === 0,
    reasons,
    faceRatio,
    score: face.score,
  };
}

export function averageDescriptors(list: FaceDescriptor[]): FaceDescriptor {
  const out = new Float32Array(list[0].length);
  for (const d of list) {
    for (let i = 0; i < out.length; i++) out[i] += d[i];
  }
  for (let i = 0; i < out.length; i++) out[i] /= list.length;
  // L2 normalize
  let norm = 0;
  for (let i = 0; i < out.length; i++) norm += out[i] * out[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the photo"));
    img.src = src;
  });
}

export async function descriptorFromImageUrl(
  dataUrl: string,
): Promise<FaceDescriptor | null> {
  const img = await loadImage(dataUrl);
  const face = await detectFaceFull(img, "enroll");
  return face?.descriptor ?? null;
}

export async function descriptorFromVideo(
  video: HTMLVideoElement,
  mode: DetectMode = "distance",
): Promise<FaceDescriptor | null> {
  if (!video.videoWidth || video.readyState < 2) return null;
  const face = await detectFaceFull(video, mode);
  return face?.descriptor ?? null;
}

/** Metadatos de la última detección a distancia (para UI). */
export async function detectFaceAtDistance(
  video: HTMLVideoElement,
): Promise<DetectedFace | null> {
  if (!video.videoWidth || video.readyState < 2) return null;
  return detectFaceFull(video, "distance");
}

export type EnrollmentCapture = {
  photoDataUrl: string;
  /** Media de cerca (compat) + lista completa cerca/lejos para matching. */
  descriptor: number[];
  descriptors: number[][];
  samples: number;
  nearSamples: number;
  farSamples: number;
  quality: FaceQuality;
};

export type EnrollProgress = {
  phase: EnrollRange;
  have: number;
  need: number;
  hint: string;
};

function snapshotPortrait(video: HTMLVideoElement): string | null {
  const canvas = document.createElement("canvas");
  const side = Math.min(video.videoWidth, video.videoHeight);
  const sx = (video.videoWidth - side) / 2;
  const sy = (video.videoHeight - side) / 2;
  canvas.width = 480;
  canvas.height = 480;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, sx, sy, side, side, 0, 0, 480, 480);
  return canvas.toDataURL("image/jpeg", 0.9);
}

/**
 * Simula cara lejana: reduce el frame y vuelve a pasar FaceNet.
 * Sirve de plantilla extra aunque el huésped no se aleje del todo.
 */
async function descriptorsFromDownscale(
  video: HTMLVideoElement,
  scales = [0.45, 0.3],
): Promise<FaceDescriptor[]> {
  const { w, h } = frameSize(video);
  if (!w || !h) return [];
  const out: FaceDescriptor[] = [];
  for (const scale of scales) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(160, Math.round(w * scale));
    canvas.height = Math.max(120, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const face = await detectOnInput(canvas, "distance");
    if (face) out.push(face.descriptor);
  }
  return out;
}

async function collectRangeSamples(
  video: HTMLVideoElement,
  range: EnrollRange,
  sampleCount: number,
  onProgress?: (p: EnrollProgress) => void,
): Promise<{
  descriptors: FaceDescriptor[];
  bestPhoto: string | null;
  bestQuality: FaceQuality | null;
  lastFail: string;
}> {
  const mode: DetectMode = range === "far" ? "distance" : "enroll";
  const descriptors: FaceDescriptor[] = [];
  let bestPhoto: string | null = null;
  let bestQuality: FaceQuality | null = null;
  let lastFail =
    range === "far"
      ? "Step back 1–2 steps and face forward."
      : "No clear face detected.";

  const maxAttempts = sampleCount * 5;
  for (
    let attempt = 0;
    attempt < maxAttempts && descriptors.length < sampleCount;
    attempt++
  ) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, range === "far" ? 220 : 180));
    }
    onProgress?.({
      phase: range,
      have: descriptors.length,
      need: sampleCount,
      hint:
        range === "near"
          ? `Near ${descriptors.length}/${sampleCount}: move the face into the frame`
          : `Far ${descriptors.length}/${sampleCount}: step back 1–2 steps`,
    });

    const face = await detectFaceFull(video, mode);
    if (!face) {
      lastFail =
        range === "far"
          ? "We can’t see you at distance. One step less back or more light."
          : "No se ve la cara. Mira de frente y con buena luz.";
      continue;
    }
    const quality = assessFaceQuality(
      face,
      video.videoWidth,
      video.videoHeight,
      range,
    );
    if (!quality.ok) {
      lastFail = quality.reasons[0] ?? lastFail;
      continue;
    }

    const photo = snapshotPortrait(video);
    descriptors.push(face.descriptor);
    if (
      !bestQuality ||
      (range === "near"
        ? quality.faceRatio > bestQuality.faceRatio
        : quality.faceRatio < bestQuality.faceRatio)
    ) {
      bestQuality = quality;
      if (photo) bestPhoto = photo;
    }
  }

  return { descriptors, bestPhoto, bestQuality, lastFail };
}

/**
 * Enrolamiento multi-distancia:
 * 1) ×3 cerca (cara grande)
 * 2) ×2 lejos (huésped se aleja)
 * 3) + plantillas simuladas por downscale del frame cercano
 */
export async function enrollFromVideo(
  video: HTMLVideoElement,
  sampleCount = 3,
  onProgress?: (p: EnrollProgress) => void,
): Promise<EnrollmentCapture> {
  await ensureFaceModels();
  if (!video.videoWidth) {
    throw new Error("Camera is not ready yet.");
  }

  const nearNeed = sampleCount;
  const farNeed = 2;

  onProgress?.({
    phase: "near",
    have: 0,
    need: nearNeed,
    hint: "Step 1/2 — Move closer: large face, looking forward",
  });

  const near = await collectRangeSamples(video, "near", nearNeed, onProgress);
  if (near.descriptors.length < nearNeed || !near.bestPhoto || !near.bestQuality) {
    throw new Error(
      `${near.lastFail} We need ${nearNeed} close-up captures (have ${near.descriptors.length}).`,
    );
  }

  // Plantillas sintéticas “a metros” desde el frame cercano actual
  const synthetic = await descriptorsFromDownscale(video);

  onProgress?.({
    phase: "far",
    have: 0,
    need: farNeed,
    hint: "Step 2/2 — Step back 1–2 steps and look at the camera",
  });

  const far = await collectRangeSamples(video, "far", farNeed, onProgress);
  // El alejamiento real es muy útil, pero no bloqueamos si falla:
  // ya tenemos cerca + downscale.
  if (far.descriptors.length < farNeed) {
    onProgress?.({
      phase: "far",
      have: far.descriptors.length,
      need: farNeed,
      hint:
        far.descriptors.length > 0
          ? `Partial far capture (${far.descriptors.length}/${farNeed}) — also using simulation`
          : "No real far shot — using digital distance simulation",
    });
  }

  const nearAvg = averageDescriptors(near.descriptors);
  const all: FaceDescriptor[] = [
    nearAvg,
    ...near.descriptors,
    ...far.descriptors,
    ...synthetic,
  ];

  // Dedup suave: si dos vectores son casi idénticos, nos quedamos con uno
  const unique: FaceDescriptor[] = [];
  for (const d of all) {
    const dup = unique.some((u) => euclideanDistance(u, d) < 0.08);
    if (!dup) unique.push(d);
  }

  return {
    photoDataUrl: near.bestPhoto,
    descriptor: Array.from(nearAvg),
    descriptors: unique.map((d) => Array.from(d)),
    samples: near.descriptors.length + far.descriptors.length,
    nearSamples: near.descriptors.length,
    farSamples: far.descriptors.length + synthetic.length,
    quality: near.bestQuality,
  };
}

/** Enrolamiento desde archivo: cerca + plantillas simuladas a distancia. */
export async function enrollFromImageDataUrl(
  dataUrl: string,
): Promise<EnrollmentCapture> {
  await ensureFaceModels();
  const img = await loadImage(dataUrl);
  const face = await detectFaceFull(img, "enroll");
  if (!face) {
    throw new Error("No face detected in the image. Upload another front-facing photo.");
  }
  const quality = assessFaceQuality(
    face,
    img.naturalWidth || img.width,
    img.naturalHeight || img.height,
    "near",
  );
  if (!quality.ok) {
    throw new Error(quality.reasons.join(" "));
  }

  const synthetic: FaceDescriptor[] = [];
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  for (const scale of [0.45, 0.3]) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(160, Math.round(w * scale));
    canvas.height = Math.max(120, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const farFace = await detectOnInput(canvas, "distance");
    if (farFace) synthetic.push(farFace.descriptor);
  }

  const templates = [face.descriptor, ...synthetic];
  return {
    photoDataUrl: dataUrl,
    descriptor: Array.from(face.descriptor),
    descriptors: templates.map((d) => Array.from(d)),
    samples: 1,
    nearSamples: 1,
    farSamples: synthetic.length,
    quality,
  };
}

/** Normaliza legado (128-D) o multi-plantilla a lista de vectores. */
export function normalizeGuestDescriptors(
  raw: number[] | number[][] | null | undefined,
): FaceDescriptor[] {
  if (!raw || !Array.isArray(raw) || raw.length === 0) return [];
  if (typeof raw[0] === "number") {
    const flat = raw as number[];
    return flat.length >= 128 ? [Float32Array.from(flat)] : [];
  }
  return (raw as number[][])
    .filter((d) => Array.isArray(d) && d.length >= 128)
    .map((d) => Float32Array.from(d));
}

export function euclideanDistance(a: FaceDescriptor, b: FaceDescriptor): number {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export type MatchResult = {
  guest: Guest;
  distance: number;
  confidence: number;
};

export async function matchLiveFace(
  live: FaceDescriptor,
  enrolled: Guest[],
  cache: Map<string, FaceDescriptor>,
  opts?: { faceRatio?: number; boosted?: boolean },
): Promise<MatchResult | null> {
  const withPhoto = enrolled.filter(
    (g) =>
      g.status !== "checked_out" &&
      (g.faceDescriptor?.length || g.photoDataUrl),
  );
  let best: MatchResult | null = null;

  const far =
    opts?.boosted ||
    (opts?.faceRatio != null && opts.faceRatio < MIN_FACE_RATIO_DISTANCE * 3);
  const threshold = far ? MATCH_THRESHOLD_DISTANCE : MATCH_THRESHOLD;

  for (const guest of withPhoto) {
    const key = `${guest.id}:${guest.photoConsentAt ?? ""}:${JSON.stringify(guest.faceDescriptor?.length ?? 0)}:${guest.photoDataUrl?.length ?? 0}`;
    let templates = normalizeGuestDescriptors(guest.faceDescriptor);

    // Cache: primer vector; si hay multi, los resolvemos siempre desde guest
    if (templates.length === 0) {
      let desc = cache.get(key);
      if (!desc && guest.photoDataUrl) {
        desc = (await descriptorFromImageUrl(guest.photoDataUrl)) ?? undefined;
        if (desc) cache.set(key, desc);
      }
      if (desc) templates = [desc];
    } else if (templates.length === 1) {
      cache.set(key, templates[0]);
    }

    if (!templates.length) continue;

    let guestBest = Infinity;
    for (const desc of templates) {
      const distance = euclideanDistance(live, desc);
      if (distance < guestBest) guestBest = distance;
    }

    const confidence = Math.max(0, Math.min(1, 1 - guestBest / threshold));
    if (!best || guestBest < best.distance) {
      best = { guest, distance: guestBest, confidence };
    }
  }

  if (!best || best.distance > threshold) return null;
  return best;
}
