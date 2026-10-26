"use client";

import { useEffect, useRef, useState } from "react";
import type { Guest } from "@/lib/guests";
import {
  MATCH_THRESHOLD_DISTANCE,
  MIN_FACE_RATIO_DISTANCE,
  areFaceModelsReady,
  averageDescriptors,
  detectFaceAtDistance,
  ensureFaceModels,
  getFaceModelLoadError,
  matchLiveFace,
  type FaceDescriptor,
} from "@/lib/face-match";
import { useAppSettings } from "@/lib/app-settings";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Camera, CameraOff, RefreshCw } from "lucide-react";

type LiveIdentifyCameraProps = {
  guests: Guest[];
  onIdentified: (guest: Guest) => void;
  className?: string;
};

type Status =
  | "off"
  | "loading_models"
  | "starting"
  | "searching"
  | "no_face"
  | "matching"
  | "identified"
  | "error";

function cameraErrorMessage(err: unknown): string {
  const name =
    err && typeof err === "object" && "name" in err
      ? String((err as { name: string }).name)
      : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera permission denied. Enable it in the browser and tap Turn on.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera found on this device.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Camera is in use (e.g. check-in photo). Close it and tap Retry.";
  }
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Camera requires HTTPS or localhost.";
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return "This browser does not support the camera.";
  }
  return "Could not start the camera. Check permissions and tap Retry.";
}

async function openCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Unsupported");
  }

  const attempts: MediaStreamConstraints[] = [
    {
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    },
    {
      video: {
        facingMode: { ideal: "user" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    },
    {
      video: { facingMode: "user" },
      audio: false,
    },
    { video: true, audio: false },
  ];

  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error("Camera failed");
}

export function LiveIdentifyCamera({
  guests,
  onIdentified,
  className,
}: LiveIdentifyCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cacheRef = useRef<Map<string, Float32Array>>(new Map());
  const liveBufferRef = useRef<FaceDescriptor[]>([]);
  const lastNotifyRef = useRef<{ id: string; at: number } | null>(null);
  const streakRef = useRef<{ id: string; count: number } | null>(null);
  const onIdentifiedRef = useRef(onIdentified);
  const guestsRef = useRef(guests);
  const startGenRef = useRef(0);

  // Apagada por defecto: evita pelear el permiso / device con el check-in
  // y cumple el gesto de usuario que piden muchos navegadores.
  const [enabled, setEnabled] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [status, setStatus] = useState<Status>("off");
  const [error, setError] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [lastDistance, setLastDistance] = useState<number | null>(null);
  const [rangeHint, setRangeHint] = useState<string | null>(null);
  const [modelsOk, setModelsOk] = useState(areFaceModelsReady());
  const [retryToken, setRetryToken] = useState(0);
  const { tr } = useAppSettings();

  useEffect(() => {
    onIdentifiedRef.current = onIdentified;
  }, [onIdentified]);

  useEffect(() => {
    guestsRef.current = guests;
    cacheRef.current.clear();
  }, [guests]);

  useEffect(() => {
    let cancelled = false;
    if (!areFaceModelsReady()) {
      setStatus((s) => (s === "off" || s === "loading_models" ? "loading_models" : s));
    }
    ensureFaceModels()
      .then(() => {
        if (!cancelled) {
          setModelsOk(true);
          setStatus((s) => (s === "loading_models" ? "off" : s));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setModelsOk(false);
          const detail = getFaceModelLoadError();
          setError(
            detail
              ? `No se pudieron cargar los modelos FaceNet. ${detail}`
              : "Could not load FaceNet models. Reload the page.",
          );
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      startGenRef.current += 1;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setCameraOn(false);
      if (modelsOk) {
        setStatus("off");
        setError(null);
      }
      setLastName(null);
      setLastDistance(null);
      setRangeHint(null);
      streakRef.current = null;
      liveBufferRef.current = [];
      return;
    }

    if (!modelsOk) {
      setStatus("loading_models");
      return;
    }

    let cancelled = false;
    const gen = ++startGenRef.current;

    async function start() {
      setError(null);
      setStatus("starting");
      try {
        const stream = await openCameraStream();
        if (cancelled || gen !== startGenRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setCameraOn(true);
        setStatus("searching");
      } catch (err) {
        if (!cancelled && gen === startGenRef.current) {
          setStatus("error");
          setError(cameraErrorMessage(err));
          setCameraOn(false);
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      // Solo soltamos el stream si nadie más ha tomado el control (nuevo start).
      if (gen === startGenRef.current) {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [enabled, modelsOk, retryToken]);

  useEffect(() => {
    if (!cameraOn) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    let cancelled = false;
    video.srcObject = stream;

    const markSearching = () => {
      if (!cancelled) setStatus((s) => (s === "starting" ? "searching" : s));
    };

    video.onloadedmetadata = markSearching;
    video.onloadeddata = markSearching;
    video.oncanplay = markSearching;

    void video.play().catch(() => {
      if (!cancelled) {
        setError(
          "The browser blocked the video. Tap Retry or Turn on again.",
        );
        setStatus("error");
        setCameraOn(false);
      }
    });

    return () => {
      cancelled = true;
      video.onloadedmetadata = null;
      video.onloadeddata = null;
      video.oncanplay = null;
    };
  }, [cameraOn]);

  useEffect(() => {
    if (!cameraOn || !enabled || !modelsOk) return;
    let cancelled = false;
    let timer: number | null = null;

    const tick = async () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth) {
        timer = window.setTimeout(() => void tick(), 400);
        return;
      }

      const enrolled = guestsRef.current.filter(
        (g) => g.photoDataUrl && g.status !== "checked_out",
      );
      if (enrolled.length === 0) {
        setStatus("searching");
        setLastName(null);
        setLastDistance(null);
        timer = window.setTimeout(() => void tick(), 700);
        return;
      }

      try {
        const detected = await detectFaceAtDistance(video);
        if (cancelled) return;

        if (!detected) {
          setStatus("no_face");
          streakRef.current = null;
          liveBufferRef.current = [];
          setLastDistance(null);
          setRangeHint(null);
          timer = window.setTimeout(() => void tick(), 350);
          return;
        }

        const shortSide = Math.min(video.videoWidth, video.videoHeight) || 1;
        const faceRatio =
          Math.min(detected.box.width, detected.box.height) / shortSide;
        if (faceRatio < MIN_FACE_RATIO_DISTANCE) {
          setStatus("no_face");
          setRangeHint("Face very far — keep moving closer along the corridor");
          timer = window.setTimeout(() => void tick(), 320);
          return;
        }

        setRangeHint(
          detected.boosted
            ? `Zoom digital · cara ${(faceRatio * 100).toFixed(0)}%`
            : faceRatio < 0.12
              ? `Media distancia · ${(faceRatio * 100).toFixed(0)}%`
              : `Close · ${(faceRatio * 100).toFixed(0)}%`,
        );

        const live = detected.descriptor;
        liveBufferRef.current = [...liveBufferRef.current, live].slice(-3);
        const smoothed =
          liveBufferRef.current.length >= 2
            ? averageDescriptors(liveBufferRef.current)
            : live;

        setStatus("matching");
        const match = await matchLiveFace(
          smoothed,
          enrolled,
          cacheRef.current,
          { faceRatio, boosted: detected.boosted },
        );
        if (cancelled) return;

        if (!match) {
          streakRef.current = null;
          setStatus("searching");
          setLastDistance(null);
          timer = window.setTimeout(() => void tick(), 380);
          return;
        }

        setLastDistance(match.distance);
        const streak = streakRef.current;
        if (streak && streak.id === match.guest.id) {
          streak.count += 1;
        } else {
          streakRef.current = { id: match.guest.id, count: 1 };
        }

        if ((streakRef.current?.count ?? 0) >= 2) {
          const now = Date.now();
          const last = lastNotifyRef.current;
          const cooldown =
            last && last.id === match.guest.id && now - last.at < 12000;
          setStatus("identified");
          setLastName(match.guest.displayName);
          if (!cooldown) {
            lastNotifyRef.current = { id: match.guest.id, at: now };
            onIdentifiedRef.current(match.guest);
          }
          timer = window.setTimeout(() => void tick(), 1000);
          return;
        }

        timer = window.setTimeout(() => void tick(), 280);
      } catch {
        if (!cancelled) {
          setStatus("searching");
          timer = window.setTimeout(() => void tick(), 500);
        }
      }
    };

    void tick();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [cameraOn, enabled, modelsOk]);

  const enrolledCount = guests.filter(
    (g) => g.photoDataUrl && g.status !== "checked_out",
  ).length;

  const statusText: Record<Status, string> = {
    off: "Camera off",
    loading_models: "Cargando FaceNet…",
    starting: "Encendiendo…",
    searching:
      enrolledCount === 0 ? "No enrolled photos" : "Looking for a match…",
    no_face: rangeHint || "Looking for a face at distance…",
    matching: "Comparando embedding…",
    identified: lastName ? `ID: ${lastName}` : "Identificado",
    error: "Error",
  };

  function placeholderText() {
    if (status === "loading_models") return "Descargando modelo FaceNet…";
    if (status === "starting") return "Requesting camera permission…";
    if (status === "error") return error || "Error starting the camera";
    if (status === "off") return "Tap Turn on to use the floor camera";
    return "Camera ready to identify";
  }

  return (
    <div className={cn("flex w-full flex-col items-center gap-2", className)}>
      <div className="flex w-full items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          {tr("cameraFloor")}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          {status === "error" && enabled ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setError(null);
                setRetryToken((n) => n + 1);
              }}
            >
              <RefreshCw className="size-3.5" aria-hidden />
              {tr("retry")}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant={enabled ? "secondary" : "default"}
            onClick={() => {
              if (enabled) {
                setEnabled(false);
                setError(null);
              } else {
                setError(null);
                setEnabled(true);
              }
            }}
            aria-pressed={enabled}
            disabled={!modelsOk}
          >
            {enabled ? (
              <>
                <CameraOff className="size-3.5" aria-hidden />
                {tr("turnOff")}
              </>
            ) : (
              <>
                <Camera className="size-3.5" aria-hidden />
                {tr("turnOn")}
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-line bg-[oklch(0.14_0.02_230)]">
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          className={cn(
            "size-full object-cover scale-x-[-1]",
            cameraOn ? "opacity-100" : "opacity-0",
          )}
        />
        {!cameraOn ? (
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center p-3 text-center text-xs",
              status === "error"
                ? "text-[oklch(0.78_0.12_25)]"
                : "text-[oklch(0.72_0.02_230)]",
            )}
          >
            {placeholderText()}
          </div>
        ) : null}
        <div
          className={cn(
            "absolute left-2 top-2 max-w-[90%] rounded px-1.5 py-0.5 font-mono text-[0.65rem] font-medium",
            status === "identified"
              ? "bg-[oklch(0.45_0.12_145)] text-white"
              : status === "error"
                ? "bg-danger text-white"
                : "bg-[oklch(0.2_0.02_230_/_0.75)] text-[oklch(0.92_0.02_230)]",
          )}
        >
          <span className="mr-1 inline-block size-1.5 rounded-full bg-current align-middle opacity-80" />
          {statusText[status]}
          {lastDistance != null && status === "identified" ? (
            <span className="opacity-80">
              {" "}
              · d={lastDistance.toFixed(2)}/
              {MATCH_THRESHOLD_DISTANCE.toFixed(2)}
            </span>
          ) : null}
        </div>
        {rangeHint && status !== "off" && status !== "error" ? (
          <div className="absolute bottom-2 left-2 right-2 rounded bg-[oklch(0.2_0.02_230_/_0.75)] px-1.5 py-0.5 text-center font-mono text-[0.6rem] text-[oklch(0.9_0.02_230)]">
            {rangeHint}
          </div>
        ) : null}
      </div>

      <p className="max-w-[16rem] text-center text-[0.7rem] leading-relaxed text-muted">
        Hotel mode: 608px detector + digital zoom when the face is small (corridor
        / reception). Check-in stays close-up (×3). Match → wristband.
      </p>
      {error ? (
        <p className="text-center text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {enabled && modelsOk && cameraOn && enrolledCount === 0 ? (
        <p className="text-center text-xs text-[oklch(0.55_0.12_70)]">
          Enroll at least one check-in photo to identify people.
        </p>
      ) : null}
    </div>
  );
}
