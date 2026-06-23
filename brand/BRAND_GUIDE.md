# Scout Brand Guide

> The single source of truth for all Scout visual communication.
> Every page, email, social post, and marketing asset must follow this guide.

---

## 1. Brand Colors

### Primary Palette

| Token          | Color         | Hex       | RGB               | Usage                              |
|----------------|---------------|-----------|-------------------|------------------------------------|
| `--red`        | Cornell Red   | `#B31B1B` | `rgb(179,27,27)`  | Primary brand color, CTAs, headers |
| `--beige`      | Warm Beige    | `#F5F0EB` | `rgb(245,240,235)`| Backgrounds, cards, sections       |

### Accent Palette

| Token              | Color          | Hex       | Usage                                 |
|--------------------|----------------|-----------|---------------------------------------|
| `--red-dark`       | Dark Red       | `#8C1515` | Hover states on primary red           |
| `--red-light`      | Light Red      | `#D44444` | Secondary highlights, badges          |
| `--beige-dark`     | Dark Beige     | `#E8DFD5` | Beige hover, borders on beige bg      |
| `--beige-light`    | Light Beige    | `#FAF7F4` | Subtle backgrounds                    |
| `--charcoal`       | Charcoal       | `#2D2D2D` | Body text                             |
| `--slate`          | Slate          | `#6B6B6B` | Secondary text, captions              |
| `--white`          | White          | `#FFFFFF` | Cards on beige bg, contrast           |
| `--success`        | Green          | `#2E7D32` | Success states, confirmations         |
| `--warning`        | Amber          | `#F59E0B` | Warnings                              |
| `--error`          | Red-Error      | `#DC2626` | Error states, destructive actions     |

### Usage Rules

- **Red** is the hero color. Use it sparingly — buttons, primary links, key highlights.
- **Beige** is the canvas color. Most page backgrounds, card backgrounds, and containers.
- **Charcoal** is for all body text. Never use pure black (`#000000`).
- **Slate** for secondary text, metadata, and placeholder text.
- **White** cards only sit on beige backgrounds. On white backgrounds, use beige-light.
- **Accent colors** must not overpower the primary red. Use them for their specific roles only.

---

## 2. Typography

### Font Family

- **Primary:** Inter (sans-serif)
- **Fallback:** system-ui, -apple-system, Segoe UI, Roboto, sans-serif

### Font Import

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
```

### Size Scale

| Token          | Size    | Line Height | Usage                  |
|----------------|---------|-------------|------------------------|
| `--text-xs`    | 0.75rem | 1rem        | Labels, legal text     |
| `--text-sm`    | 0.875rem| 1.25rem     | Captions, metadata     |
| `--text-base`  | 1rem    | 1.5rem      | Body text              |
| `--text-lg`    | 1.125rem| 1.75rem     | Large body, intro text |
| `--text-xl`    | 1.25rem | 1.75rem     | Subheadings            |
| `--text-2xl`   | 1.5rem  | 2rem        | Section headings       |
| `--text-3xl`   | 1.875rem| 2.25rem     | Page headings          |
| `--text-4xl`   | 2.25rem | 2.5rem      | Hero headings          |
| `--text-5xl`   | 3rem    | 1.1         | Large hero (display)   |

### Font Weights

| Weight | Value | Usage                              |
|--------|-------|------------------------------------|
| Light  | 300   | Large hero text only               |
| Regular| 400   | Body text                          |
| Medium | 500   | Strong body, nav items             |
| Semibold| 600  | Subheadings, button text           |
| Bold   | 700   | Headings, primary CTAs             |
| Extra Bold| 800| Display headings only              |

### Typography Rules

- **Body text:** Inter Regular 400, `--text-base` (1rem/16px), `--charcoal`.
- **Headings:** Inter Bold 700 on red or charcoal. Use red for marketing hero headings; charcoal for UI section headings.
- **Buttons:** Inter Semibold 600, `--text-sm` (0.875rem/14px), uppercase for primary CTAs.
- **Links:** Always red (`#B31B1B`), underline on hover, never blue.
- **Line length:** Max 75 characters per line for body text.

---

## 3. Logo Usage

See [logo-usage.md](./logo-usage.md) for full specifications, variants, and examples.

### Quick Rules

- **Minimum clear space:** Equal to the height of the "S" in "Scout" on all sides.
- **Minimum size:** 32px tall for the full logo, 24px for the mark-only variant.
- **Do not** recolor, stretch, outline, rotate, or add effects to the logo.
- **Do not** place the logo on busy imagery or low-contrast backgrounds.

---

## 4. Spacing & Layout Tokens

### Spacing Scale

| Token              | Value   | Usage                        |
|--------------------|---------|------------------------------|
| `--space-1`        | 0.25rem | Tight inner padding          |
| `--space-2`        | 0.5rem  | Element spacing              |
| `--space-3`        | 0.75rem | Button padding               |
| `--space-4`        | 1rem    | Card padding, grid gap       |
| `--space-6`        | 1.5rem  | Section spacing              |
| `--space-8`        | 2rem    | Page margins                 |
| `--space-10`       | 2.5rem  | Large section breaks         |
| `--space-12`       | 3rem    | Major layout gaps            |
| `--space-16`       | 4rem    | Page section padding         |
| `--space-20`       | 5rem    | Hero section padding         |

### Border Radius

| Token               | Value | Usage                    |
|---------------------|-------|--------------------------|
| `--radius-sm`       | 4px   | Small elements, inputs   |
| `--radius-md`       | 8px   | Cards, buttons           |
| `--radius-lg`       | 12px  | Modals, large cards      |
| `--radius-xl`       | 16px  | Hero sections, banners   |
| `--radius-full`     | 9999px| Pills, avatars, badges   |

### Shadows

| Token               | Value                                         | Usage                  |
|---------------------|-----------------------------------------------|------------------------|
| `--shadow-sm`       | `0 1px 2px rgba(0,0,0,0.05)`                | Subtle elevation       |
| `--shadow-md`       | `0 4px 6px rgba(0,0,0,0.07)`                | Cards, dropdowns       |
| `--shadow-lg`       | `0 10px 15px rgba(0,0,0,0.1)`               | Modals, navigation     |
| `--shadow-xl`       | `0 20px 25px rgba(0,0,0,0.15)`              | Hero sections, overlays|

---

## 5. Social Media Template Specs

### Profile & Cover Images

| Platform       | Profile Image | Cover Image              | Aspect Ratio |
|----------------|---------------|--------------------------|--------------|
| Twitter/X      | 400×400 px    | 1500×500 px              | 3:1 cover    |
| LinkedIn       | 400×400 px    | 1584×396 px              | 4:1 cover    |
| Instagram      | 320×320 px    | —                        | 1:1          |
| Facebook       | 170×170 px    | 1640×624 px (desktop)    | ~2.6:1       |
| YouTube        | 800×800 px    | 2560×1440 px             | 16:9         |

### Post Image Specs

| Image Type      | Dimensions  | Aspect | Notes                            |
|-----------------|-------------|--------|----------------------------------|
| Standard Post   | 1200×630 px | 1.91:1 | Open Graph / social share        |
| Square Post     | 1080×1080 px| 1:1    | Instagram feed                   |
| Story           | 1080×1920 px| 9:16   | Instagram / LinkedIn stories     |
| Twitter Card    | 1200×600 px | 2:1    | Twitter summary card             |

### Branding on Templates

- Place the Scout logo in the top-left or top-center with proper clear space.
- Primary headline in red (`#B31B1B`), secondary text in charcoal (`#2D2D2D`).
- Background: white or beige (`#F5F0EB`). Avoid photos as full backgrounds.
- CTA buttons: red background, white text, rounded (8px radius).
- Minimum clearance from edges: 40px on all sides.

---

## 6. Email Header Template Specs

### Dimensions & Layout

| Element         | Spec                                |
|-----------------|-------------------------------------|
| Width           | 600px max (centered)                |
| Header Height   | 80–120px                            |
| Logo            | 120–160px wide, left aligned        |
| Background      | White (`#FFFFFF`) or beige (`#F5F0EB`) |
| Divider         | 1px solid `#B31B1B` below header    |

### Email Header Code Template

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td align="center" style="padding: 20px 0; background-color: #F5F0EB;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding: 24px 32px; background-color: #FFFFFF; border-radius: 8px 8px 0 0;">
            <img src="https://scout.app/logo-email.png"
                 alt="Scout"
                 width="140"
                 height="auto"
                 style="display: block; border: 0;" />
          </td>
        </tr>
        <tr>
          <td style="border-bottom: 1px solid #B31B1B;"></td>
        </tr>
      </table>
    </td>
  </tr>
</table>
```

### Typography in Emails

- **Headline:** 24px, Inter Bold, `#2D2D2D`.
- **Body:** 16px, Inter Regular, `#2D2D2D`.
- **Link:** `#B31B1B`, underline.
- **Button (CTA):** Red (`#B31B1B`) background, white Inter Semibold text, 14px, 12px vertical / 24px horizontal padding, 8px radius.

### Email Footer Spec

- Small text (12px), slate (`#6B6B6B`), centered.
- Unsubscribe link always present.
- Physical mailing address on a new line.

---

## 7. Accessibility

- All text/background color combinations must meet WCAG AA contrast ratio (4.5:1 for normal text, 3:1 for large text).
- Red/beige combination on buttons: white text on red (`#B31B1B`) passes AA at 16px+ bold.
- Link underline on hover (not color alone) for link identification.
- Minimum touch target: 44×44 px for interactive elements on mobile.

---

> **Maintain this guide.** Any divergence from the brand palette or typography scale must be approved by the Scout design team. Updates to this document should be proposed via PR and reviewed by at least one other team member.
