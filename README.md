# Noongar — remember every person’s name

Web prototype for people who **aren’t good with names**: recognise the person (search / QR / photo) and cue the wristband. The hotel scenario validates the ops flow before a mobile app and BLE hardware.

**Noongar** means “person” or “people” — community and extended family. UI language is **English**.

## Local

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

## Temporary public demo on Hostinger (Git)

Use **hPanel → Node.js web app → Import Git repository** (GitHub or GitLab).

| Setting | Value |
|---------|--------|
| Branch | `main` |
| Build script | `build` |
| Output directory | `out` |
| Entry file | *(empty — static)* |
| Node | 20 or 22 |

Full steps: [`deploy/README.md`](./deploy/README.md).

## Qué puedes probar

1. **Nuevo cliente**: alta con fechas de estancia (entrada/salida, habitación, idioma) y noches totales.
2. **Buscar** por nombre o habitación (datos mock del PMS + altas de la sesión).
3. **Código QR** pegando un token (`HN-312-MARIA`) o usando la pestaña **QR de demo**.
4. **Editar** un huésped: estancia, preferencias y marca operativa — **lista negra**, **VIP** (dorado) o **Silver** (info extra).
5. **Ajustes**: idioma de la interfaz (ES/EN) y qué campos mostrar en la pulsera (nombre, habitación, noches, marca).
6. **Pulsera**: según ajustes — nombre, habitación, noches y/o marca (**ALERTA** / **VIP** / **SILVER**).
7. **Foto check-in**: consentimiento + captura **cerca y lejos** + plantillas simuladas a distancia (`sessionStorage`).
8. **Cámara planta** (columna derecha): FaceNet 128-D; match → pulsera.

Detalle técnico: [`docs/reconocimiento-facial.md`](./docs/reconocimiento-facial.md) · distancia en hotel: [`docs/reconocimiento-a-distancia.md`](./docs/reconocimiento-a-distancia.md).

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Componentes al estilo shadcn (Button, Input)
- Datos mock en `src/lib/guests.ts`

## Documentación

- Propuesta técnica (arquitectura, hardware, RGPD, seguridad): [`docs/propuesta-reconocimiento-huespedes.md`](./docs/propuesta-reconocimiento-huespedes.md)
- Producto / diseño: `PRODUCT.md`, `DESIGN.md`

## Siguiente paso (app móvil)

Cuando el flujo web convenza:

1. Reutilizar el mismo modelo de datos e identidad QR/NFC.
2. App nativa o Capacitor con escáner de cámara real.
3. GATT BLE hacia pulsera ESP32+OLED.
4. Facial solo si hay dictamen RGPD favorable (on-device + consentimiento).

## Aviso

Datos de demostración. No usar con datos reales de huéspedes sin base legal, contratos y medidas de seguridad.
