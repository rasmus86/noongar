# Reconocimiento de huéspedes a distancia (hotel)

En recepción o pasillo la cara ocupa pocos píxeles. El check-in cercano y la cámara de planta **no deben usar los mismos umbrales**.

## Capas (de más impacto a menos)

| Capa | Qué aporta | En este prototipo | En producción hotel |
|------|------------|-------------------|---------------------|
| Óptica / sensor | Más px en la cara a 3–8 m | Webcam 1080p si el dispositivo la tiene | Cámara IP 4–8 mm / varifocal, 1080p–4K, buena luz o IR |
| Colocación | Ángulo frontal al flujo de personas | Webcam del portátil/móvil | Altura ojos, evitar contraluz de entrada |
| Detección | Encontrar caras pequeñas | TinyFace `inputSize: 608`, score bajo | SSD/RetinaFace o cámara con IA en edge |
| Zoom / ROI | Ampliar zona útil | Zoom digital 70%→50%→35% centrado | ROI fijo en pasillo o PTZ suave |
| Embedding | Identidad estable | FaceNet 128-D + media temporal | ArcFace/MobileFaceNet 512-D si se necesita más margen |
| Umbral | Menos falsos negativos lejos | `0.58` cerca / `0.62` si cara pequeña o zoom | Calibrar con datos reales del hotel |
| Enrolamiento | Buena plantilla multi-distancia | Check-in ×3 cerca + ×2 lejos + simulación downscale | Cabina/tablet + paso atrás guiado |

## Flujo recomendado en planta

1. **Check-in multi-distancia** (tablet/móvil): ×3 cerca, luego el huésped se aleja ×2; además se generan plantillas simulando distancia (downscale).
2. **Cámara de zona** (recepción / acceso restaurante): mira el flujo a 2–6 m.
3. Detección → si la caja es pequeña, **ROI ampliado** → embedding → match contra **todas** las plantillas del huésped.
4. Aviso a **pulsera** del empleado (nombre, habitación, noches restantes / ALERTA).

## Límites realistas

- A **>6–8 m** con webcam de portátil la tasa cae mucho; hace falta óptica de pasillo.
- Perfil / gafas de sol / mascarilla / contraluz empeoran el match.
- Legalmente (RGPD) sigue siendo biometría: zona acotada, cartel, alternativa QR/NFC, borrado al checkout.

## Qué hace ya HostNotify

- Modo `distance` en cámara planta (detector 608 + zoom digital).
- Hint en UI: cerca / media distancia / zoom digital.
- Check-in: cerca (estricto) + alejamiento guiado + plantillas simuladas; matching multi-plantilla.
