# Reconocimiento facial en el prototipo HostNotify

## Por qué fallaba el enfoque anterior

1. **Descriptor débil**: comparación de píxeles en escala de grises 48×48 (no es FaceNet).
2. **Espejo inconsistente**: la foto de check-in se guardaba volteada respecto al vídeo live.
3. **Sin landmarks**: el recorte no alineaba la cara.

## Enfoque actual (óptimo viable en navegador)

| Capa | Tecnología | Rol |
|------|------------|-----|
| Detección | TinyFaceDetector (`@vladmandic/face-api`) | Localiza la cara en vídeo/foto |
| Alineación | FaceLandmark68Net | 68 puntos para alinear antes del embedding |
| Embedding | FaceRecognitionNet (FaceNet 128-D) | Vector de identidad |
| Matching | Distancia euclídea | Umbral `0.55` (estricto; FaceNet clásico usa ~0.6) |

Modelos en `public/models/face-api/` (formato **`.bin`** de `@vladmandic/face-api`, no los `*-shard*` del face-api.js antiguo). Si falla lo local, el loader intenta el CDN de jsDelivr. Inferencia 100 % en cliente (WebGL si está disponible).

Si ves error de carga: comprueba en red que existan
`/models/face-api/tiny_face_detector_model.bin` y
`/models/face-api/face_recognition_model.bin` (HTTP 200).

## Alternativa aún más precisa (futuro)

MediaPipe FaceLandmarker + **MobileFaceNet / ArcFace ONNX** (512-D) vía ONNX Runtime Web suele superar a FaceNet-128, a costa de más peso de modelo y alineación ArcFace 112×112. Para el MVP hotelero, FaceNet en face-api ofrece el mejor equilibrio precisión/esfuerzo.

## Mejoras en el enrolamiento (check-in)

1. **3 fotogramas** con cara detectada y calidad OK (tamaño ≥22 % del cuadro, centrada).
2. **Embedding medio** L2-normalizado → más robusto que una sola foto.
3. En planta, media temporal de 2–3 embeddings live antes de comparar.
4. Umbral euclídeo `0.58`.

## Consejos de uso

1. **Vuelve a capturar** con «Capturar (×3)» (las fotos antiguas sin plantilla se recalculan, pero peor).
2. Luz frontal; evita contraluz.
3. Espera a FaceNet y a ver la cara grande y centrada.
4. El badge muestra `d=…/0.58` cuando hay match (menor = más parecido).
