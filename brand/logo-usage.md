# Scout Logo Usage Guide

> Official specifications for the Scout logo — variants, clearance, sizing, and common mistakes.

---

## Logo Variants

### 1. Full Horizontal Logo (Primary)
**Use:** Website headers, email signatures, social media profiles, print materials.
```
┌─────────────────────────────────────┐
│  [Scout Logo Mark]    S C O U T     │
│                        . a p p      │
└─────────────────────────────────────┘
```
- Layout: Mark to the left, "Scout" wordmark to the right.
- Tagline ".app" below "Scout" in lighter weight.
- Preferred variant for almost all uses.

### 2. Stacked Logo (Alternate)
**Use:** Square spaces, app icons, favicons, small containers.
```
┌───────────┐
│           │
│  [Logo]   │
│  Mark     │
│           │
│  S C O U T│
│   .app    │
└───────────┘
```
- Mark centered above the wordmark.
- Use when horizontal space is constrained (under 200px wide).

### 3. Mark Only (Icon)
**Use:** Favicon, app launcher icon, avatar, loading states.
```
┌─────┐
│     │
│  S  │
│     │
└─────┘
```
- The stylized "S" mark alone.
- No text. No tagline.
- Minimum size: 24px.

### 4. Wordmark Only (Text)
**Use:** Navigation bars, footers, legal disclaimers (when mark would be redundant).
```
S C O U T
 .app
```
- "Scout" in Inter Extra Bold, ".app" in Inter Regular.
- Never use without consulting the design team — the wordmark alone lacks the brand mark.

---

## Clear Space

The logo must have breathing room on all sides. The minimum clear space is equal to the height of the uppercase **"S"** in "Scout".

```
┌─────────────────────────────────┐
│                                 │
│    ┌───────────────────────┐    │
│    │                       │    │
│    │   [Clear Space = S]   │    │
│    │                       │    │
│    └───────────────────────┘    │
│                                 │
└─────────────────────────────────┘
```

- No text, graphics, or UI elements may intrude into the clear space.
- On social media templates, extend to 40px minimum clearance regardless of logo size.

---

## Minimum Sizes

| Variant             | Print      | Digital     |
|---------------------|------------|-------------|
| Full Horizontal     | 0.75 in    | 32px tall   |
| Stacked             | 0.5 in     | 28px tall   |
| Mark Only           | 0.375 in   | 24px tall   |
| Wordmark Only       | 0.5 in     | 20px tall   |

Never reproduce the logo below these minimum sizes — it becomes unreadable and the mark detail is lost.

---

## Correct Usage ✅

| ✅ Correct                                    | Why                                    |
|-----------------------------------------------|----------------------------------------|
| Logo on white background                      | Maximum contrast, cleanest look        |
| Logo on beige (`#F5F0EB`) background          | Acceptable secondary option            |
| Logo with clear space respected               | Professional appearance                |
| Logo sized proportionally (lock aspect ratio) | Prevents distortion                    |
| Red logo on light backgrounds                 | Brand-consistent color application     |
| White logo on dark red or charcoal backgrounds| Inverse variant for dark sections      |

---

## Incorrect Usage ❌

| ❌ Incorrect                                  | Why                                    |
|-----------------------------------------------|----------------------------------------|
| Recoloring the logo to any non-red/non-white  | Dilutes brand recognition              |
| Stretching or squashing the logo              | Distorts proportions — always constrain|
| Adding drop shadows, glows, or effects        | Breaks the clean brand aesthetic       |
| Rotating the logo                             | Logo must sit horizontally or stacked  |
| Outlining or stroking the logo                | Never add borders                      |
| Placing logo on busy photography              | Reduces legibility                     |
| Using logo smaller than minimum size          | Unreadable at small sizes              |
| Rearranging mark and wordmark positions       | Fixed layout per variant               |
| Changing the font of the wordmark             | Always Inter (Extra Bold for "Scout")  |
| Adding text or graphics inside clear space    | Clutters the logo                      |
| Using the mark as a bullet point or decoration| Not its intended use                   |

---

## Color Variations by Background

| Background              | Logo Color         |
|-------------------------|--------------------|
| White (`#FFFFFF`)       | Red (`#B31B1B`)    |
| Beige (`#F5F0EB`)       | Red (`#B31B1B`)    |
| Red (`#B31B1B`)         | White (`#FFFFFF`)  |
| Dark Red (`#8C1515`)    | White (`#FFFFFF`)  |
| Charcoal (`#2D2D2D`)    | White (`#FFFFFF`)  |
| Photo (light area)      | Red (`#B31B1B`)    |
| Photo (dark area)       | White (`#FFFFFF`)  |

When in doubt, use the red logo on white or beige backgrounds. Avoid the gray area — if the background contrast is uncertain, default to white + red on a color block.

---

## File Formats

| Format | Use Case                        |
|--------|---------------------------------|
| SVG    | Web, digital, scalable vector   |
| PNG    | Email, social, fallback for web |
| PDF    | Print, client handoff           |
| Figma  | Design files (source of truth)  |

*(Actual SVG/PNG files TBD — this spec documents expected output.)*

---

## Download

Logo assets are maintained in the `brand/assets/` directory of this repository. If you need a variant not listed here, reach out to the Scout design team.

> **Last updated:** June 2026
> **Owner:** Scout Design Team
