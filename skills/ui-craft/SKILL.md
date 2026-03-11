---
name: ui-craft
description: Use when implementing UI/UX. Provides a 5-phase design process emphasizing distinctive aesthetics, accessibility, and purposeful interaction. Loaded automatically by Maestro.
---

# UI Craft

Make it beautiful. Make it distinctive. Make it yours — not another AI-generated template.

## 5-Phase Process

### Phase 1: Design Intent

Answer these before touching code:
- **Purpose:** What does this UI element accomplish for the user?
- **Audience:** Who uses this? What do they expect?
- **Tone:** Professional, playful, bold, minimal, luxurious, technical?
- **Constraints:** Mobile-first? Existing design system? Accessibility requirements?

If constraints are unclear, check the codebase for existing patterns before inventing new ones.

### Phase 2: Aesthetic Direction

Choose a bold direction. If unsure, propose 2-3 options. Never default to generic.

Read `references/aesthetic-directions.md` for direction guidance.

The direction informs every decision in Phase 3. Lock it in before moving on.

### Phase 3: Visual System

Build a coherent system, not disconnected components:

**Typography:**
- Choose fonts that match the aesthetic direction
- Read `references/typography-guide.md` for pairing guidance
- Avoid Inter, Roboto, Arial unless the project already uses them and changing would break consistency

**Color:**
- Build a palette: 1 primary, 1 accent, neutrals
- Use OKLCH color space for perceptual consistency (`oklch(60% 0.15 250)`)
- Ensure contrast ratios meet WCAG AA (4.5:1 for normal text, 3:1 for large)

**Spacing:**
- Define a rhythm (4px, 8px, 16px, 24px, 32px, 48px, 64px)
- Maintain it consistently throughout

**Components:**
- Each component should have visual personality
- Not every component needs the same treatment — vary weight, border, shadow

### Phase 4: Motion & Interaction

Motion should be purposeful. Every animation must answer: "What does this communicate?"

- Staggered reveals on page load (not instant)
- State transitions (hover, focus, active) should feel responsive
- Scroll-triggered animations where they add context (not just decoration)
- Hover states: something unexpected but not annoying
- Always include: `@media (prefers-reduced-motion: reduce)` override

### Phase 5: Implementation

- Semantic HTML (use the right element, not just `div`)
- Mobile-first (start with mobile, add breakpoints for larger)
- Keyboard navigation (all interactive elements focusable, logical tab order)
- ARIA roles where native semantics are insufficient
- Lazy loading for images and heavy content
- Minimal DOM depth (avoid div soup)

## References

- `references/aesthetic-directions.md` — guidance on each aesthetic direction
- `references/typography-guide.md` — font pairings and rules
- `references/anti-patterns.md` — what to never produce

## Hard Prohibitions

Read `references/anti-patterns.md` before starting. These are non-negotiable.
