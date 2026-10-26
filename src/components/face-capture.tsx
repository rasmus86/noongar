"use client";

import { useEffect, useRef, useState } from "react";
import type { Guest } from "@/lib/guests";
import {
  enrollFromImageDataUrl,
  enrollFromVideo,
  ensureFaceModels,
  type EnrollProgress,
} from "@/lib/face-match";
import { GuestAvatar } from "@/components/guest-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Camera, ImagePlus, Trash2, X } from "lucide-react";

type FaceCaptureProps = {
  guest: Guest;
  onSave: (
    photoDataUrl: string,
    consentAt: string,
    faceDescriptor: number[] | number[][] | null,
  ) => void;
  onClear: () => void;
  onClose?: () => void;
  className?: string;
};

function cameraErrorMessage(err: unknown): string {
  const name =
    err && typeof err === "object" && "name" in err
      ? String((err as { name: string }).name)
      : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera permission denied. Enable it in the browser or upload an image.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera found on this device.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Camera is in use by another app. Close it and try again.";
  }
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Camera requires HTTPS or localhost. Open the app on a secure URL.";
  }
  return "Could not open the camera. Check browser permissions or upload a file.";
}

export function FaceCapture({
  guest,
  onSave,
  onClear,
  onClose,
  className,
}: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [consent, setConsent] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [descriptor, setDescriptor] = useState<number[] | number[][] | null>(
    null,
  );
  const [sampleInfo, setSampleInfo] = useState<string | null>(null);
  const [progress, setProgress] = useState<EnrollProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);

  useEffect(() => {
    ensureFaceModels()
      .then(() => setModelsReady(true))
      .catch(() => setModelsReady(false));
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!cameraOn) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    let cancelled = false;
    setVideoReady(false);

    const onReady = () => {
      if (!cancelled && video.videoWidth > 0) setVideoReady(true);
    };

    video.srcObject = stream;
    video.onloadedmetadata = onReady;
    video.onloadeddata = onReady;
    video.oncanplay = onReady;

    void video
      .play()
      .then(() => {
        if (!cancelled && video.videoWidth > 0) setVideoReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "The browser blocked video playback. Tap “Open camera” again.",
          );
        }
      });

    const poll = window.setInterval(() => {
      if (video.videoWidth > 0) {
        setVideoReady(true);
        window.clearInterval(poll);
      }
    }, 100);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      video.onloadedmetadata = null;
      video.onloadeddata = null;
      video.oncanplay = null;
    };
  }, [cameraOn]);

  function releaseStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function stopCamera() {
    releaseStream();
    setCameraOn(false);
    setVideoReady(false);
    setStarting(false);
    setCapturing(false);
    setProgress(null);
  }

  async function startCamera() {
    setError(null);
    if (!consent) {
      setError("Tick guest consent before using the camera.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "This browser does not support the camera. Use “Upload image” or open in up-to-date Chrome/Safari.",
      );
      return;
    }

    setStarting(true);
    setPreview(null);
    setDescriptor(null);
    setSampleInfo(null);
    setProgress(null);
    setVideoReady(false);
    releaseStream();
    setCameraOn(false);

    try {
      await ensureFaceModels();
      setModelsReady(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
    } catch (err) {
      releaseStream();
      setCameraOn(false);
      setError(cameraErrorMessage(err));
    } finally {
      setStarting(false);
    }
  }

  async function captureFrame() {
    const video = videoRef.current;
    if (!video) return;
    setError(null);
    setCapturing(true);
    setProgress({
      phase: "near",
      have: 0,
      need: 3,
      hint: "Step 1/2 — Move closer: large face, looking forward",
    });
    setSampleInfo("Enrolling near + far…");
    try {
      const enrolled = await enrollFromVideo(video, 3, setProgress);
      setPreview(enrolled.photoDataUrl);
      setDescriptor(
        enrolled.descriptors.length > 1
          ? enrolled.descriptors
          : enrolled.descriptor,
      );
      setSampleInfo(
        `${enrolled.nearSamples} near + ${enrolled.farSamples} far/sim · ${enrolled.descriptors.length} FaceNet templates`,
      );
      setProgress(null);
      stopCamera();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enrolar la cara.");
      setSampleInfo(null);
      setProgress(null);
    } finally {
      setCapturing(false);
    }
  }

  async function onFileChange(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!consent) {
      setError("Tick guest consent before uploading the photo.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("El archivo debe ser una imagen.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("Image too large (max 4 MB).");
      return;
    }
    setCapturing(true);
    setSampleInfo("Analysing face + distance templates…");
    const reader = new FileReader();
    reader.onload = async () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (!result) {
        setError("No se pudo leer la imagen.");
        setCapturing(false);
        return;
      }
      try {
        await ensureFaceModels();
        const enrolled = await enrollFromImageDataUrl(result);
        setPreview(enrolled.photoDataUrl);
        setDescriptor(
          enrolled.descriptors.length > 1
            ? enrolled.descriptors
            : enrolled.descriptor,
        );
        setSampleInfo(
          `Valid photo · ${enrolled.descriptors.length} templates (near + sim. far)`,
        );
        stopCamera();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid image.");
        setPreview(null);
        setDescriptor(null);
        setSampleInfo(null);
      } finally {
        setCapturing(false);
      }
    };
    reader.onerror = () => {
      setError("Error al leer el archivo.");
      setCapturing(false);
    };
    reader.readAsDataURL(file);
  }

  function save() {
    if (!preview) return;
    if (!consent) {
      setError("Consent is required to save the photo.");
      return;
    }
    if (!descriptor) {
      setError("Missing face embedding. Capture or upload the photo again.");
      return;
    }
    setSaving(true);
    const consentAt = new Date().toISOString();
    onSave(preview, consentAt, descriptor);
    setSaving(false);
    setPreview(null);
    setDescriptor(null);
    setSampleInfo(null);
    setConsent(false);
    onClose?.();
  }

  const showPlaceholder = !cameraOn && !preview && !guest.photoDataUrl;

  return (
    <section
      className={cn(
        "rounded-xl border border-line bg-bg px-4 py-4 sm:px-5",
        className,
      )}
      aria-label={`Enroll photo for ${guest.displayName}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink">
            Guest photo (check-in)
          </h3>
          <p className="mt-1 max-w-xl text-sm text-muted text-pretty">
            We capture <strong className="font-medium text-ink">close-up</strong>{" "}
            (×3), then ask them to{" "}
            <strong className="font-medium text-ink">step back</strong> (×2), plus
            simulated distance templates — so the floor camera recognises
            better at a few metres.
          </p>
        </div>
        {onClose ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            aria-label="Close enrollment"
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface px-3 py-3 text-sm text-ink">
        <input
          type="checkbox"
          className="mt-1 size-4 accent-[oklch(0.48_0.12_230)]"
          checked={consent}
          onChange={(e) => {
            setConsent(e.target.checked);
            setError(null);
          }}
        />
        <span className="text-pretty">
          Guest <strong>{guest.fullName}</strong> explicitly consents that their
          photo and face template may be used during the stay for staff
          visual/automatic recognition, and may request deletion.
        </span>
      </label>

      {cameraOn || capturing ? (
        <ol className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <li
            className={cn(
              "rounded-lg border px-3 py-2",
              progress?.phase === "near"
                ? "border-primary/50 bg-primary/5 text-ink"
                : "border-line bg-surface text-muted",
            )}
          >
            <span className="font-medium text-ink">1. Close-up</span>
            <span className="mt-0.5 block text-xs">
              Large face, front-facing, good light
            </span>
          </li>
          <li
            className={cn(
              "rounded-lg border px-3 py-2",
              progress?.phase === "far"
                ? "border-primary/50 bg-primary/5 text-ink"
                : "border-line bg-surface text-muted",
            )}
          >
            <span className="font-medium text-ink">2. Step back</span>
            <span className="mt-0.5 block text-xs">
              1–2 steps back, keep looking at the camera
            </span>
          </li>
        </ol>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="relative aspect-square max-h-80 w-full max-w-sm overflow-hidden rounded-lg border border-line bg-[oklch(0.16_0.02_230)]">
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            className={cn(
              "size-full object-cover scale-x-[-1]",
              cameraOn
                ? "relative z-10"
                : "pointer-events-none absolute inset-0 opacity-0",
            )}
          />

          {!cameraOn && preview ? (
            <img
              src={preview}
              alt="Capture preview"
              className="size-full object-cover"
            />
          ) : null}

          {!cameraOn && !preview && guest.photoDataUrl ? (
            <img
              src={guest.photoDataUrl}
              alt={`Current photo of ${guest.fullName}`}
              className="size-full object-cover"
            />
          ) : null}

          {showPlaceholder ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <GuestAvatar guest={guest} size="xl" />
              <p className="text-sm text-[oklch(0.78_0.02_230)]">
                No photo yet
              </p>
            </div>
          ) : null}

          {(cameraOn && !videoReady) || capturing ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-[oklch(0.16_0.02_230_/_0.55)] px-4 text-center">
              <p className="text-sm text-white">
                {capturing
                  ? progress?.hint || sampleInfo || "Analysing face…"
                  : "Starting camera…"}
              </p>
            </div>
          ) : null}

          {cameraOn && videoReady && !capturing ? (
            <div className="absolute bottom-2 left-2 right-2 z-20 rounded bg-[oklch(0.2_0.02_230_/_0.75)] px-2 py-1 text-center text-[0.65rem] text-[oklch(0.92_0.02_230)]">
              On capture: close-up first, then we’ll ask you to step back
            </div>
          ) : null}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="flex flex-col gap-2 md:min-w-44">
          {!cameraOn ? (
            <Button
              type="button"
              onClick={startCamera}
              disabled={!consent || starting || capturing}
              aria-busy={starting}
            >
              <Camera className="size-4" aria-hidden />
              {starting ? "Opening…" : "Open camera"}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                onClick={() => void captureFrame()}
                disabled={!videoReady || capturing || !modelsReady}
              >
                <Camera className="size-4" aria-hidden />
                {capturing
                  ? progress?.phase === "far"
                    ? "Capturing far…"
                    : "Capturing close-up…"
                  : videoReady
                    ? "Capture near + far"
                    : "Waiting for image…"}
              </Button>
              <Button type="button" variant="secondary" onClick={stopCamera}>
                Cancel camera
              </Button>
            </>
          )}

          <Button
            type="button"
            variant="secondary"
            disabled={!consent || capturing}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="size-4" aria-hidden />
            Upload image
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(e) => void onFileChange(e.target.files?.[0])}
          />

          {preview ? (
            <Button
              type="button"
              variant="accent"
              onClick={save}
              disabled={saving || !descriptor}
            >
              {saving ? "Saving…" : "Save photo + templates"}
            </Button>
          ) : null}

          {guest.photoDataUrl ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onClear();
                setPreview(null);
                setDescriptor(null);
                setSampleInfo(null);
              }}
            >
              <Trash2 className="size-4" aria-hidden />
              Delete photo
            </Button>
          ) : null}
        </div>
      </div>

      {sampleInfo && !capturing ? (
        <p className="mt-3 text-sm text-accent">{sampleInfo}</p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
