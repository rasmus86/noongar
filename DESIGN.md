# DESIGN.md — Noongar (Harbour Light)

## Mood
Coastal daylight on a quiet harbour morning — soft sea-glass teal, pale blue-grey air, white space as courtesy. Name tags, not cameras.

## Strategy
Restrained Operate UI. Sea-glass primary carries brand; surfaces stay near-white with a cool coastal wash. Brand wordmark leads (Space Grotesk bold). UI language is English only.

## Palette (OKLCH)
- bg: `oklch(0.995 0.004 210)`
- surface: `oklch(0.97 0.014 205)`
- ink: `oklch(0.27 0.03 230)`
- muted: `oklch(0.5 0.03 215)`
- line: `oklch(0.9 0.02 210)`
- primary: `oklch(0.52 0.09 200)` (sea-glass)
- accent: `oklch(0.62 0.1 195)` (soft coastal for wristband CTAs)
- danger: `oklch(0.52 0.15 25)`

## Typography
- Brand wordmark: Space Grotesk Bold (tech-implied geometric)
- UI: Source Sans 3
- Data/tokens: IBM Plex Mono

## Motion
Short state feedback (150–280 ms, ease-out). Header brand settles once. Bracelet fade with TTL. Respect `prefers-reduced-motion`.

## Layout
- Brand large top-left (wordmark only)
- Settings / New guest stay top-right
- Hero tech image beside headline
- Same home elements; more air between groups
