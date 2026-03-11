# Typography Guide

## Pairing Principles

1. **Contrast creates hierarchy.** Pair a display font with a readable body font.
2. **Avoid same-family conflicts.** Don't pair two serifs or two heavy sans.
3. **Limit to 2-3 typefaces.** More creates chaos, not richness.
4. **Weight variation > font variation.** A single variable font can do more than two different fonts.

## Recommended Pairings by Aesthetic

### Brutalist / Technical
- Display: Space Grotesk Bold, IBM Plex Mono
- Body: Space Grotesk Regular, JetBrains Mono

### Luxury Minimalism
- Display: Cormorant Garamond Light (40px+), Playfair Display
- Body: Jost, DM Sans

### Retro-Futuristic
- Display: Exo 2, Orbitron (sparingly — best at large sizes only)
- Body: IBM Plex Sans, Rajdhani

### Playful / Friendly
- Display: Nunito ExtraBold, Fredoka One
- Body: Nunito Regular, Quicksand

### Editorial / Maximalist
- Display: Cabinet Grotesk, Clash Display
- Body: Satoshi, General Sans

## Variable Fonts Worth Using

- **Inter** — Only acceptable for dense data interfaces. Otherwise, find something more interesting.
- **Recursive** — Great variable font for dev tools (code + UI share a family).
- **Cabinet Grotesk** — Geometric with personality. Good for headings.
- **Satoshi** — Clean, warm geometric. Good body font.

## Size Scale (rem-based, base 16px)

```
xs:   0.75rem  (12px)  — labels, captions
sm:   0.875rem (14px)  — secondary body
base: 1rem     (16px)  — body
lg:   1.125rem (18px)  — large body
xl:   1.25rem  (20px)  — small headings
2xl:  1.5rem   (24px)  — section headings
3xl:  1.875rem (30px)  — page headings
4xl:  2.25rem  (36px)  — hero text
5xl:  3rem     (48px)  — display
6xl:  3.75rem  (60px)  — large display
```

## Letter Spacing Rules

- **All-caps labels:** Always add letter-spacing (0.05–0.15em)
- **Display/hero text:** Slightly negative letter-spacing (-0.02em) for large sizes
- **Body text:** No letter-spacing modifications
- **Monospace:** No modifications needed

## Line Height Rules

- **Body text:** 1.5–1.7 (comfortable reading)
- **Headings:** 1.1–1.3 (tighter for display)
- **Code:** 1.6–1.8 (needs more room)
