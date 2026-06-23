# Branded Empty State Design System

> **Last Updated:** June 2026
> **Brand Colors:** Cornell Red `#B31B1B` | Warm Beige `#F5F0EB` | White `#FFFFFF` | Dark Charcoal `#2C2C2C`

Every empty state in Scout should turn a dead end into an actionable opportunity. This document defines the patterns, copy templates, illustration direction, and CTA guidance for all app surfaces.

---

## Table of Contents

1. [Visual Foundation](#1-visual-foundation)
2. [No Search Results](#2-no-search-results)
3. [No Messages Yet](#3-no-messages-yet)
4. [No Connections Yet](#4-no-connections-yet)
5. [No Notifications](#5-no-notifications)
6. [Network Empty State (New User)](#6-network-empty-state-new-user)
7. [Error / Offline Empty State](#7-error--offline-empty-state)
8. [Implementation Checklist](#8-implementation-checklist)

---

## 1. Visual Foundation

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--scout-red` | `#B31B1B` | Primary accent, CTAs, illustration highlights |
| `--scout-beige` | `#F5F0EB` | Background container, illustration fills |
| `--scout-white` | `#FFFFFF` | Card / modal backgrounds |
| `--scout-charcoal` | `#2C2C2C` | Body text |
| `--scout-gray-500` | `#6B7280` | Secondary / muted text |

### Typography

| Element | Style |
|---------|-------|
| **Title** | 20px / 1.3, Semi-Bold (600), Dark Charcoal |
| **Body** | 15px / 1.5, Regular (400), Gray-500 |
| **CTA Button** | 14px / 1, Semi-Bold (600), White on Red |

### Layout

- **Spacing:** 24px padding around illustration, 16px gap between title and body, 24px between body and CTA
- **Alignment:** Centered horizontally, vertically centered in viewport (use `flex` or grid with min-height)
- **Max width:** 320px for copy block

---

## 2. No Search Results

**Used when:** A user performs a search (alumni, companies, events) and zero results match their query.

### Copy Template

```
We searched the whole roster...
No [sport] [entity] found in [filters] yet.
```

**Examples:**

| Surface | Copy |
|---------|------|
| Alumni search | _"We searched the whole roster… No hockey alumni found in Finance yet."_ |
| Company search | _"We searched the whole roster… No tech companies with Ithaca offices yet."_ |
| Event search | _"We searched the whole roster… No lacrosse events in Boston yet."_ |

### Dynamic Copy Rules

1. **Sport** — Read from user's current sport filter or profile sport. Default to `"Cornell"` if no sport selected.
2. **Entity** — Use noun matching the current search context: `"alumni"`, `"companies"`, `"events"`, `"opportunities"`.
3. **Filters** — Summarize active filters concisely (e.g., `"Finance"`, `"NYC"`, `"this week"`). Omit if none applied.

### Illustration Direction

- A stylized magnifying glass resting on a warm beige field
- A small red pennant flag marks where the search result "should be"
- Soft scatter of dots around the glass (debris / dust effect)
- **File:** `brand/illustrations/no-results.svg`

### CTA Guidance

| Context | CTA Label | Action |
|---------|-----------|--------|
| Alumni search | `"Clear filters"` | Reset all search filters |
| Company search | `"Browse all companies"` | Navigate to full company directory |
| Event search | `"See upcoming events"` | Navigate to event feed |
| Generic | `"Try a different search"` | Focus search input |

---

## 3. No Messages Yet

**Used when:** A user's inbox / messaging screen has zero conversations.

### Copy Template

```
No messages yet
Your first conversation is a tap away — reach out to a teammate, mentor, or fellow alum.
```

### Illustration Direction

- A warm beige envelope with a small red heart peeking out from the flap
- A single dashed line trails from the envelope (a "path" to the first message)
- **File:** `brand/illustrations/no-messages.svg`

### CTA Guidance

| Context | CTA Label | Action |
|---------|-----------|--------|
| Alumni | `"Find someone to message"` | Navigate to alumni directory |
| Student | `"Browse your network"` | Open connections list |
| Generic | `"Start a conversation"` | Open suggested contacts modal |

---

## 4. No Connections Yet

**Used when:** A user's network / connections screen shows zero connections.

### Copy Template

```
Your network is empty
Find your first teammate — connect with fellow Cornellians to unlock mentors, opportunities, and your next big move.
```

### Illustration Direction

- A simple network graph with three nodes: two unconnected on a warm beige background
- A third red node floats above them with a dotted line reaching down (the "first connection" waiting to happen)
- **File:** `brand/illustrations/no-connections.svg`

### CTA Guidance

| Context | CTA Label | Action |
|---------|-----------|--------|
| Alumni | `"Discover alumni"` | Open alumni browse |
| Student | `"Find teammates"` | Open student-athlete directory |
| Generic | `"Explore your network"` | Open suggested connections |

---

## 5. No Notifications

**Used when:** A user's notification center has zero notifications (all read or never generated).

### Copy Template

```
All caught up!
No news from your network right now. Check back after your next connection or event.
```

### Illustration Direction

- A warm beige bell with a tiny red dot at the top (quiet / inactive indicator)
- Soft concentric arcs radiating from the bell — suggestion of potential future rings
- **File:** `brand/illustrations/no-notifications.svg`

### CTA Guidance

| Context | CTA Label | Action |
|---------|-----------|--------|
| Generic | `"Meet someone new"` | Navigate to alumni / network directory |
| Alumni | `"Post an opportunity"` | Navigate to opportunity creation |
| Student | `"RSVP to an event"` | Navigate to events feed |

---

## 6. Network Empty State (New User)

**Used when:** A brand-new user has just signed up and has zero network, zero messages, zero activity.

### Copy Template

```
Welcome to the Big Red Network
You're the newest member of the Cornell alumni community. Start building your network — search for teammates, companies, or events to get going.
```

### Illustration Direction

- A warm beige circle (the "universe") with a single red star in the center — the new user
- Small gray dots radiate outward (future connections waiting to be made)
- A subtle compass rose in the corner (direction / guidance motif)
- **File:** `brand/illustrations/welcome-empty.svg`

### CTA Guidance

| Context | CTA Label | Action |
|---------|-----------|--------|
| New user | `"Build your network"` | Launch onboarding flow |
| New user | `"Find your sport"` | Set sport preferences |
| New user | `"Skip for now"` | Dismiss and go to home feed |

### Progressive Enhancement

On the **third** visit to this state (detected via local storage or user meta), swap the primary CTA to:

```
"Take the tour" → Launch interactive product tour
```

---

## 7. Error / Offline Empty State

**Used when:** A network request fails or the user is offline and no cached data is available.

### Copy Template (Offline)

```
You're off the grid
No internet connection found. Your network updates will appear once you're back online.
```

### Copy Template (Error)

```
Something went wrong
We couldn't load this page. If this keeps happening, reach out to your network admin.
```

### Illustration Direction

- A warm beige wireframe of a Cornell campus landmark (e.g., the clock tower / McGraw Tower) with dashed outlines
- A small red "reconnect" arrow in the corner
- **File:** `brand/illustrations/error-empty.svg`

### CTA Guidance

| Context | CTA Label | Action |
|---------|-----------|--------|
| Offline | `"Try again"` | Retry network request |
| Error | `"Refresh page"` | Reload current view |
| Persistent error | `"Contact support"` | Open mailto / support form |

---

## 8. Implementation Checklist

### Component Architecture

```
components/
  empty-states/
    EmptyState.tsx          # Generic container wrapper
    NoSearchResults.tsx     # Search-specific variant
    NoMessages.tsx          # Inbox-specific variant
    NoConnections.tsx       # Network-specific variant
    NoNotifications.tsx     # Notification-specific variant
    WelcomeEmpty.tsx        # New-user variant
    ErrorEmpty.tsx          # Error / offline variant
```

### Props Interface (TypeScript)

```typescript
interface EmptyStateProps {
  variant:
    | "no-search-results"
    | "no-messages"
    | "no-connections"
    | "no-notifications"
    | "welcome"
    | "error"
    | "offline";
  sport?: string;               // Used by no-search-results
  entity?: string;              // Used by no-search-results
  filters?: string;             // Used by no-search-results
  onCtaClick?: () => void;     // Callback for primary action
  ctaLabel?: string;           // Override default CTA label
  secondaryCta?: {
    label: string;
    onClick: () => void;
  };
}
```

### Accessibility

- Each illustration must include `role="img"` and an `aria-label`
- CTAs must be `<button>` or `<a>` elements, not divs
- Copy block must use semantic headings (`<h2>` for title, `<p>` for body)
- Color contrast: Red on White passes AA, Charcoal on Beige passes AA

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| **Mobile** (< 640px) | Stack: illustration centered above copy block. Padding 16px. |
| **Tablet** (640–1024px) | 24px padding, optional side-by-side on wider tablets. |
| **Desktop** (> 1024px) | Centered max-width 400px with 32px padding. |

---

## Appendix: Brand Asset Deliverables

All illustration SVGs live in `brand/illustrations/` and follow these rules:

1. ViewBox: `0 0 200 200`
2. Primary fill: `#F5F0EB` (warm beige)
3. Accent fill / stroke: `#B31B1B` (Cornell red)
4. Seconday stroke: `#D1D5DB` (light gray)
5. No embedded fonts (use `<text>` with system-safe fallback only inside prototype mocks)
6. Export from Figma with "Minify SVG" enabled

---

*This document is maintained by the Scout Design Team.*
*Questions? Open an issue in #scout-design.*
