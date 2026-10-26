# Propuesta técnica: reconocimiento de huéspedes en hotel (móvil → cámara pin + pulsera)

**Prioridad:** viabilidad legal y operativa por encima de sofisticación tecnológica.  
**Ámbito geográfico:** España / Unión Europea.  
**Fecha de referencia del marco normativo:** 2026 (RGPD + LOPDGDD + criterios AEPD).

---

## 0. Supuestos explícitos

| # | Supuesto | Si cambia… |
|---|----------|------------|
| A | El hotel opera en **España** y trata datos de huéspedes/empleados bajo **RGPD + LOPDGDD**. | Fuera de la UE cambiarían bases legales, autoridades y obligaciones de transferencia. |
| B | Existe un **PMS** (Opera, Mews, Cloudbeds, Protel, etc.) con API o exportación de reservas: nombre, habitación, fechas, estado check-in. | Sin API: integración por CSV/exportación manual o middleware; aumenta latencia y riesgo de datos desactualizados. |
| C | El objetivo operativo es **personalizar el saludo / atención en recepción o pasillos**, no control de acceso físico ni vigilancia continua de zonas comunes. | Si hay control de acceso o videovigilancia 24/7, sube el riesgo legal (EIPD más exigente, posible rechazo AEPD). |
| D | En Etapa 1 el **móvil del empleado** captura imagen y consulta un servicio de matching; el PMS aporta el nombre. | Si el matching es 100 % en el dispositivo, mejora privacidad (menos envío de biometría) pero complica sincronización de plantillas. |
| E | En Etapa 2 la **cámara pin** envía frames o embeddings al móvil (o a un hub), y el móvil/hub empuja el **nombre** a la pulsera por BLE. | Si la pulsera habla solo con un gateway fijo, el móvil deja de ser imprescindible en planta. |
| F | No hay aún **fotos de referencia** de huéspedes en el sistema. | Hay que diseñar un enrolamiento explícito (check-in voluntario). Sin plantilla previa, el facial no identifica. |
| G | Presupuesto de hardware por empleado: **bajo** (decenas de euros, no cientos). | Descarta smartwatches premium y cámaras industriales embebidas. |

**Supuesto crítico de producto:** si el facial no supera el filtro legal (muy probable sin consentimiento inequívoco y EIPD favorable), la arquitectura de Etapa 1/2 debe poder pivotar a **QR / NFC / confirmación voluntaria** sin rehacer todo el stack de notificación a pulsera.

---

## 1. Arquitectura técnica

### 1.1 Principio de diseño

```
[Fuente de identidad] → [Motor de resolución "quién es"] → [Contexto PMS] → [Notificación al empleado]
```

El facial es **solo una fuente de identidad**. La pulsera y el bus de eventos deben ser independientes del método de detección.

### 1.2 Etapa 1 — Móvil como sensor y hub

```
┌─────────────┐     HTTPS/API      ┌──────────────────┐
│  PMS hotel  │ ◄─────────────────► │  Backend hotel   │
│ (reservas)  │                     │  (BFF / API)     │
└─────────────┘                     └────────┬─────────┘
                                             │ sync huéspedes
                                             │ en casa (nombre,
                                             │ hab., plantilla*)
┌─────────────┐   cámara + ML on-device       │
│ Móvil       │ ◄────────────────────────────┘
│ empleado    │
│ - captura   │──► matching local o mínimo envío
│ - muestra   │     de embedding cifrado
│   ficha     │──► UI: "María G. · Hab. 312"
└─────────────┘
```

\*Plantilla biométrica solo si hay base legal y consentimiento; preferible no almacenar foto cruda.

**Componentes software**

| Capa | Rol | Opciones viables |
|------|-----|------------------|
| App móvil | Captura, matching, UI, BLE (Etapa 2) | Flutter / React Native / nativo Kotlin+Swift |
| On-device vision | Detección + embedding facial | ML Kit / MediaPipe / TFLite (modelo ligero) |
| Backend | Auth empleados, sync PMS, auditoría, políticas de retención | Node/FastAPI + Postgres |
| Integración PMS | Reservas activas del día | API oficial o iPaaS (si no hay API) |
| Almacén plantillas | Vectores biométricos cifrados (si aplica) | Separado del PMS; clave por tenant; TTL = checkout + margen |
| Observabilidad | Logs sin PII innecesaria | Quién consultó qué habitación/hora, no la imagen |

**Flujo Etapa 1 (recomendado)**

1. Empleado autentica la app (SSO o PIN + dispositivo registrado).
2. App descarga **solo huéspedes in-house** del día (nombre display, habitación, opcional plantilla).
3. Cámara detecta rostro → genera embedding **en el teléfono**.
4. Matching local contra plantillas del día (umbral de confianza + “no match”).
5. Si hay match: muestra ficha; registra evento de uso (auditoría).
6. Al checkout / fin de día: borra plantillas del dispositivo y del backend.

**Comunicación:** HTTPS al backend; sin Bluetooth en Etapa 1.

### 1.3 Etapa 2 — Cámara pin + pulsera con display

```
        BLE (GATT) / Wi‑Fi opcional
┌──────────────┐      frames/embeddings       ┌─────────────┐
│ Cámara pin   │ ───────────────────────────► │ Móvil/hub   │
│ (sensor+MCU) │ ◄── config, heartbeat ────── │ (matching)  │
└──────────────┘                              └──────┬──────┘
                                                     │
                                                     │ BLE notify
                                                     │ (nombre corto)
                                                     ▼
                                              ┌─────────────┐
                                              │ Pulsera     │
                                              │ OLED/e‑ink  │
                                              └─────────────┘
```

**Roles**

| Dispositivo | Función | No debe hacer |
|-------------|---------|---------------|
| Cámara pin | Capturar / (opcional) detectar rostro y enviar embedding o JPEG comprimido | Almacenar biometría a largo plazo |
| Móvil o hub ESP32/RPi | Matching, consulta PMS, política de privacidad, cifrado | Exponer API abierta en LAN sin auth |
| Pulsera | Mostrar nombre (y quizás habitación) unos segundos | Guardar historial de huéspedes |

**Protocolo BLE sugerido (simple y barato)**

- Cámara → móvil: servicio GATT propietario o modo “Wi‑Fi Direct / hotspot local” si el bitrate de vídeo supera BLE.
- Móvil → pulsera: notificación BLE corta (`NAME|ROOM|TTL`), payload &lt; 20–100 bytes.
- Emparejamiento: bonding con PIN/Passkey; lista blanca de MAC/identity keys por empleado.
- Alcance útil interior: **5–15 m** realista; no diseñar como cobertura de todo el hotel con un solo móvil.

**Topología alternativa (más escalable):** gateway fijo en recepción (Raspberry Pi / NUC) + varias cámaras IP/USB mínimas + pulseras BLE. El “pin en el móvil” queda como prototipo, no como arquitectura final de planta.

---

## 2. Hardware económico: cámara pin y pulsera

### 2.1 Realidad sobre la “cámara del tamaño de un pin”

Una cámara verdaderamente tipo “pin/espía” de pocos euros **no suele servir** para reconocimiento facial fiable (poca resolución, lente pobre, sin IR, foco fijo, ruido).  
Opciones viables en “muy pequeño / barato” vs “útil para caras”:

#### Opción C1 — Módulo ESP32-CAM / ESP32-S3-CAM (más viable como prototipo)

| Criterio | Valor típico |
|----------|--------------|
| Coste | ~5–15 € módulo |
| Sensor | OV2640 / OV5640 |
| Resolución útil | 640×480 a 2MP (mejor OV5640) |
| Conectividad | Wi‑Fi (BLE limitado o ausente según placa) |
| Autonomía | Mala a batería (cientos de mA en captura); mejor USB/powerbank |
| Ventajas | Barato, comunidad enorme, prototipado rápido |
| Limitaciones | No es “tamaño pin”; Wi‑Fi más que BLE; privacidad peor si streama JPEG; calor |

**Veredicto:** bueno para **POC Etapa 2**, no para producto discreto de solapa.

#### Opción C2 — Cámara BLE “wearable” / nRF + sensor (Himax, GC2145, etc.)

| Criterio | Valor típico |
|----------|--------------|
| Coste | ~25–80 € en desarrollo (módulos + PCB custom) |
| Resolución | A menudo QVGA–VGA |
| Conectividad | BLE 5.x |
| Autonomía | Mejor que ESP32-CAM si duty-cycle agresivo |
| Ventajas | Más cercano al form factor “pin/broche” |
| Limitaciones | Ancho de banda BLE insuficiente para vídeo continuo; hay que enviar **embeddings o frames a baja tasa**; diseño PCB + carcasa no trivial |

**Veredicto:** camino de producto si se insiste en pin; exige ingeniería, no solo compra en AliExpress.

#### Opción C3 — Usar la cámara del móvil + “gatillo” BLE barato

No hay cámara pin: un botón/beacon BLE activa captura en el móvil (ya en el bolsillo/solapa con clip).

| Criterio | Valor |
|----------|-------|
| Coste | 5–20 € (botón BLE) |
| Resolución / matching | La del móvil (alta) |
| Autonomía | Excelente en el botón; móvil se carga igual |
| Ventajas | Máxima calidad facial; menos hardware; Etapa 2 casi solo pulsera |
| Limitaciones | No cumple la estética “cámara pin”; dependencia del móvil |

**Veredicto:** **recomendado** si el requisito pin es negociable: mejor ROI y menos riesgo técnico.

### 2.2 Pulsera con display (barata para empleados)

#### Opción P1 — ESP32-C3 / ESP32-S3 + OLED 0.96" (SSD1306) en correa

| Criterio | Valor |
|----------|-------|
| Coste BOM | ~8–20 € |
| Pantalla | OLED 128×64 monocromo |
| BLE | Sí (nativo) |
| Autonomía | 1–2 días típicos con sleep agresivo; mejorable con LiPo + carga USB‑C |
| Ventajas | Muy barata, fácil de programar (Arduino/ESP-IDF), texto legible |
| Limitaciones | Fea/“maker”; OLED puede quemarse; no resistente IP67 de serie |

#### Opción P2 — MCU nRF52840 + OLED / Sharp Memory LCD

| Criterio | Valor |
|----------|-------|
| Coste BOM | ~15–35 € |
| Pantalla | OLED o Memory LCD (mejor exterior) |
| BLE | Excelente (Nordic) |
| Autonomía | Superior al ESP32 (días–semana según UI) |
| Ventajas | Consumo, stack BLE maduro |
| Limitaciones | Curva de aprendizaje (Zephyr/nRF SDK); suministro de PCBs |

#### Opción P3 — Pulsera e‑ink / “badge” tipo LilyGo T-Wristband o similar

| Criterio | Valor |
|----------|-------|
| Coste | ~20–40 € unidad maker |
| Pantalla | TFT u OLED según modelo (e‑ink real más caro) |
| Autonomía | Variable; e‑ink gana en estático |
| Ventajas | Más “producto”; firmware de ejemplo |
| Limitaciones | Stock irregular; no siempre industrial; soporte limitado |

#### Opción P4 — Etiqueta LED/Matrix o beep+LED (sin nombre completo)

Mostrar código de 3 letras / color / vibración en vez de nombre.

| Ventajas | Limitaciones |
|----------|--------------|
| Más barato, más privado (menos PII en radio) | Peor UX; el empleado debe mirar el móvil |

**Recomendación hardware Etapa 2 (equilibrio coste/viabilidad):**

1. Prototipo: **móvil (matching) + pulsera ESP32-C3+OLED (P1)**.  
2. Cámara: empezar con **C3 (móvil)** o **C1 (ESP32-CAM en recepción)**; solo invertir en C2 si el pin es requisito firme tras validar legal.  
3. Evitar “mini cámaras espía” genéricas: calidad insuficiente y percepción muy negativa (huéspedes/empleados/AEPD).

---

## 3. Requisitos legales y de privacidad (España / UE)

> Esto **no es asesoría jurídica vinculante**. Antes de cualquier piloto con datos reales, conviene dictamen de DPO / abogado especializado y, si aplica, consulta previa a la AEPD.

### 3.1 Clasificación del dato

- El reconocimiento facial con identificación genera **datos biométricos** destinados a identificar de forma unívoca a una persona → **categoría especial**, art. 9 RGPD.
- También hay datos de reserva (nombre, habitación) y, en Etapa 2, datos de empleados (uso de pulsera, logs de atención).

### 3.2 Base legal

Para biometría (art. 9):

- En hospitalidad, la vía habitual alegada es el **consentimiento explícito** (art. 9.2.a).
- El consentimiento debe ser **libre, específico, informado e inequívoco**. En un hotel, si el check-in “normal” queda peor sin consentir, el consentimiento **puede no ser libre**.
- Interés legítimo (art. 6.1.f) **no basta solo** para biometría; hace falta una excepción del art. 9.
- “Necesario para ejecutar el contrato de alojamiento” es **discutible y arriesgado**: el alojamiento se puede prestar sin facial.

**Conclusión práctica:** el facial orientado a “saludo personalizado” tiene **alto riesgo de no ser proporcional**. La AEPD ha sido restrictiva con reconocimiento facial en contextos no esenciales.

### 3.3 Obligaciones típicas si aún se plantea biometría

| Obligación | Qué implica en el hotel |
|------------|-------------------------|
| EIPD (DPIA) | Obligatoria en la práctica ante biometría + posible evaluación sistemática |
| Minimización | Embeddings con TTL; no vídeo continuo; no retención post-checkout |
| Transparencia | Cláusula en check-in + **cartelería** visible en zona de captura |
| Consentimiento | Opt-in separado; alternativa equivalente sin biometría; registro de prueba |
| Derechos | Acceso, supresión, retirada de consentimiento tan fácil como darlo |
| Encargados | Contratos art. 28 con cloud/PMS/vision vendors; ubicaciones UE o cláusulas |
| Empleados | Información LOPDGDD; no usar el sistema para vigilar rendimiento sin base; consulta a representación legal si aplica |
| Registro de actividades | Inventario de tratamientos actualizado |
| Seguridad art. 32 | Cifrado, control de acceso, borrado, pruebas |

### 3.4 Cartelería e información a huéspedes

En zona donde haya cámara / uso de móvil para identificar:

- Quién es el responsable del tratamiento (hotel / cadena).
- Finalidad: p. ej. “personalización del servicio con consentimiento”.
- Que hay **alternativa** sin biometría.
- Derechos y canal de contacto del DPO.
- Si hay videovigilancia clásica, no mezclar finalidades en el mismo cartel sin claridad.

### 3.5 Empleados y pulseras

- La pulsera trata datos del **huésped** (nombre en pantalla) y metadatos del **empleado**.
- Evitar que el display muestre apellidos completos + habitación en zonas públicas (minimización: “María · 312” o solo nombre de pila según política).
- Prohibir fotos del display / logs sociales.
- No usar eventos de detección para evaluar productividad sin base legal específica.

### 3.6 Señal de semáforo legal (operativa)

| Enfoque | Semáforo |
|---------|----------|
| Facial obligatorio u “opcional” sin alternativa real | Rojo |
| Facial con opt-in claro, EIPD, borrado al checkout, zona limitada | Ámbar (aún frágil) |
| QR/NFC/app voluntaria + notificación a empleado | Verde relativo |
| Solo PMS + pregunta “¿Sr./Sra. X?” tras ver reserva | Verde |

---

## 4. Riesgos de seguridad y mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Intercepción BLE (sniffing del nombre) | Filtración de PII en radio | Bonding; payload mínimo; alias; rotar connection IV; no enviar foto por BLE; preferir link cifrado LE Secure Connections |
| Emparejamiento fraudulento de pulsera | Empleado fantasma recibe nombres | Provisioning en app con código de un solo uso; whitelist; revocación remota |
| Suplantación de cámara (dispositivo rogue) | Inyección de imágenes / DoS | Certificado de dispositivo; emparejamiento inicial físico; firma de firmware |
| Ataque de presentación (foto/vídeo ante cámara) | Identificación falsa | Liveness básico en móvil; umbral alto; confirmación humana en recepción |
| Robo/pérdida del móvil del empleado | Acceso a plantillas del día | App con auth fuerte; cifrado en reposo; borrado remoto; plantillas solo en memoria / Keystore |
| Backend expuesto / IDOR | Enumeración de huéspedes | AuthZ por rol y turno; rate limit; no APIs “list all guests” abiertas |
| Retención excesiva | Incumplimiento RGPD + mayor superficie | TTL automático al checkout; job de purga; prohibido entrenamiento de modelos con caras de huéspedes |
| Insider (curiosidad del staff) | Abuso de consultas | Auditoría de accesos; alertas por volumen anómalo; política sancionadora |
| Proveedor cloud de vision | Transferencia ilegal / secondary use | Preferir on-device; si cloud, UE + contrato + prohibición de training |

**Regla de oro:** la pulsera solo recibe **texto efímero**, nunca biometría ni identificadores estables del huésped más allá de lo necesario para el saludo.

---

## 5. Alternativas menos invasivas (mismo objetivo operativo)

Objetivo operativo realista: *“El empleado sabe a quién está atendiendo para saludar por su nombre / ofrecer contexto.”*

| Alternativa | Cómo funciona | Pros | Contras |
|-------------|---------------|------|---------|
| **QR de check-in / llave digital** | Huésped muestra QR; app resuelve reserva | Bajo riesgo legal, barato, fiable | Requiere gesto del huésped |
| **NFC en llave o pulsera de huésped** | Tap en móvil/lector | Muy UX en recepción | Coste de tags; no sirve a distancia |
| **Código corto en app del hotel** | 4–6 dígitos del día | Sin biometría | Fricción; posible reenvío |
| **Beacon BLE del huésped (opt-in app)** | Presencia aproximada | Manos libres si ya usan app | Instalación app; precisión de sala |
| **Confirmación verbal + ficha PMS** | Empleado busca por habitación/nombre | Cero biometría | Menos “wow”, más errores |
| **Reserva con foto voluntaria no biométrica** | Foto en ficha solo visual para el empleado (sin matching automático) | Menos automatización = menos art. 9 si no hay procesamiento biométrico automatizado | Aún hay imagen personal; sigue habiendo deberes de transparencia/minimización |

**Recomendación:** diseñar el sistema como **“Guest Presence → Staff Notify”** con conector `identity_provider = qr | nfc | facial_opt_in | manual`. Implementar primero QR/NFC; dejar facial como conector opcional solo tras OK legal.

---

## 6. Orden de implementación práctico (Etapa 1 antes que Etapa 2)

### Fase −1 — Prototipo web (actual)

Validar UX y datos mock en navegador (`HostNotify` en este repo) antes de app nativa:

- Búsqueda PMS + token QR + ficha + simulación de pulsera.
- Foto check-in ×3 + cámara planta con modo **distancia** (zoom digital).
- Criterio de salida: el personal entiende el flujo; QR/manual siempre como fallback.
- Ver también `docs/reconocimiento-a-distancia.md`.

### Fase 0 — Viabilidad legal y de negocio (obligatoria)

**Hacer**

- Definir finalidad única y proporcional.
- Consulta DPO / asesoría; decidir si facial está en scope o se aparca.
- Mapa de datos (PMS → app → logs).
- Redactar textos de transparencia y, si aplica, consentimiento + cartel.

**Validar**

- [ ] Dictamen escrito: facial sí/no/condicionado.  
- [ ] Alternativa equivalente documentada.  
- [ ] EIPD iniciada si hay biometría.

**Salida:** go / no-go para biometría. Si no-go → continuar con QR/NFC sin perder el roadmap de pulsera.

### Fase 1 — Integración PMS + app “ficha de huésped” (sin cámara)

**Hacer**

- Auth empleados.
- Sync huéspedes in-house (nombre para display, habitación, status).
- Pantalla de búsqueda manual / por habitación.
- Auditoría de consultas.
- Política de borrado diario.

**Validar**

- [ ] Nombre correcto vs PMS en &gt;99 % casos de prueba.  
- [ ] Latencia sync &lt; 1–2 min tras check-in (o webhook).  
- [ ] Borrado post-checkout verificado.  
- [ ] Prueba de rol: un recepcionista no ve reservas de otro hotel/propiedad.

### Fase 2 — Identidad no biométrica (QR o NFC)

**Hacer**

- Emitir QR/NFC en check-in (o usar el de la llave digital existente).
- Escaneo en app → ficha instantánea.
- Métricas: tiempo de resolución de identidad, tasa de error, aceptación del huésped.

**Validar**

- [ ] Tiempo medio “gesto → nombre en pantalla” &lt; 3 s.  
- [ ] Funciona offline parcial (caché del día) si cae Wi‑Fi.  
- [ ] Huéspedes entienden el gesto (prueba con 20–30 check-ins reales).

### Fase 3 — Etapa 1 con cámara del móvil (solo si Fase 0 = go)

**Hacer**

- Enrolamiento voluntario en check-in (captura controlada).
- Matching on-device; umbrales; “no identificado”.
- Cartelería en zona de uso.
- Destrucción de plantillas al checkout.

**Validar**

- [ ] False accept rate aceptable en prueba ciega (definir umbral de negocio, p. ej. ≪ 0,1 % en set de prueba).  
- [ ] False reject manejable (empleado cae a QR/manual).  
- [ ] Retirada de consentimiento borra plantilla en &lt; X minutos.  
- [ ] Ninguna imagen cruda sale del dispositivo (verificación técnica).

### Fase 4 — Pulsera display (parte de Etapa 2, independiente del facial)

**Hacer**

- Prototipo P1 (ESP32+OLED).
- App envía nombre efímero por BLE tras cualquier identidad (QR primero).
- Autonomía, legibilidad, emparejamiento.

**Validar**

- [ ] Lectura a 50–70 cm con luz de recepción.  
- [ ] Autonomía ≥ 1 turno completo (8–12 h) con margen.  
- [ ] No empareja un dispositivo no provisionado.  
- [ ] El mensaje desaparece solo (TTL 5–15 s).

### Fase 5 — Cámara pin / broche (solo tras Fases 3–4)

**Hacer**

- POC con ESP32-CAM o botón BLE que dispara el móvil (C3).
- Medir si la calidad justifica el pin real (C2).

**Validar**

- [ ] Misma calidad de matching que Etapa 1 (no degradar).  
- [ ] Alcance y estabilidad radio en planta real.  
- [ ] Percepción de huéspedes/empleados (encuesta); si genera rechazo, abortar form factor.

### Fase 6 — Piloto controlado y endurecimiento

- Una sola zona (recepción), personal formado, monitorización de incidentes, revisión EIPD, decisión de escalar o apagar facial.

---

## 7. Arquitectura objetivo “a prueba de veto legal”

```
                    ┌─────────────────────┐
                    │  PMS (fuente truth) │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Guest Directory    │
                    │  (in-house only)    │
                    └──────────┬──────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
   [QR / NFC]           [Manual search]        [Facial opt-in]
         │                     │                     │
         └─────────────────────┴─────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Staff Notify Bus   │
                    │  (móvil / hub)      │
                    └──────────┬──────────┘
                               │ BLE efímero
                    ┌──────────▼──────────┐
                    │  Pulsera display    │
                    └─────────────────────┘
```

Así, si el facial se tumba legalmente, **siguen vivos** PMS, app, bus de notificación y pulsera.

---

## 8. Costes orientativos de prototipo (orden de magnitud)

| Ítem | Coste aprox. |
|------|----------------|
| App + backend MVP (esfuerzo) | Dominante frente a hardware |
| Pulsera ESP32+OLED × N empleados | 10–25 € / ud |
| ESP32-CAM POC | 5–15 € |
| Lectores NFC o impresión QR | Muy bajo |
| Asesoría RGPD / EIPD | Imprescindible; no omitir por “MVP” |

---

## 9. Recomendación final (ejecutiva)

1. **No empezar por la cámara pin ni por el facial.** Empezar por PMS → app empleado → identidad QR/NFC → pulsera.  
2. Tratar el facial como **experimento condicionado** a dictamen legal, consentimiento real y matching on-device con borrado al checkout.  
3. Para Etapa 2 barata: **pulsera ESP32-C3 + OLED**; cámara pin solo si un POC demuestra calidad; si no, botón BLE + cámara del móvil.  
4. Seguridad centrada en: poco dato en radio, bonding, TTL, auditoría y cero retención post-estancia.  
5. La métrica de éxito no es “detectar caras”, sino **resolver identidad de forma legal, rápida y aceptada** para personalizar el servicio.
