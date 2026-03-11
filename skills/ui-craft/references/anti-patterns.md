# UI Anti-Patterns — Never Produce These

## The AI Website
Purple-to-blue gradient hero. White rounded cards. Soft shadows everywhere.
Poppins or Inter. Blue CTA button. "Transform your workflow" headline.
**Why it's bad:** Instantly recognizable as AI-generated. Zero personality. Zero trust.

## The Box Factory
Every element: `border-radius: 8px`, `box-shadow: 0 2px 8px rgba(0,0,0,0.1)`, `padding: 16px`.
**Why it's bad:** Visual monotony. Everything looks the same weight. Nothing has hierarchy.

## The Font Coward
Uses Inter, Roboto, or Arial "because they're safe."
**Why it's bad:** No differentiation. The font is part of the brand. Neutral fonts say nothing.
**Exception:** If the project already uses these and breaking consistency would be worse.

## The Animation Glutton
Every element: `transition: all 0.3s ease`. Page load has 12 different animations.
**Why it's bad:** Noise. Animation should guide attention, not compete for it.

## The Contrast Criminal
Light gray text on white background. Small font. "It's subtle and elegant."
**Why it's bad:** Inaccessible. Fails WCAG AA. Users with low vision (and tired eyes) can't read it.

## The Stock Photo Hero
Generic business people shaking hands. Diverse team laughing at laptop.
**Why it's bad:** Immediately communicates inauthenticity. Use illustration, abstract, or product shots.

## The Responsive Afterthought
Designed at 1440px. On mobile: text overflows, buttons too small, layout broken.
**Why it's bad:** 60%+ of traffic is mobile. Mobile-first is not optional.

## The Identical Component Syndrome
Every card, modal, and panel looks identical. Same border, same padding, same shadow.
**Why it's bad:** No visual hierarchy. User can't tell what's important.

## The Purple Gradient
`background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
This specific gradient has been used in >10,000 "modern" web apps.
**Why it's bad:** Instantly dated. Marks the site as a template.
