# AGENTS.md Templates

## Root Project Template

```markdown
# [Project Name]

## Overview
[1-2 sentence description of what this project does]

## Tech Stack
- **Framework:** [e.g., Next.js 14 with App Router]
- **Language:** [e.g., TypeScript 5.x]
- **Database:** [e.g., PostgreSQL via Drizzle ORM]
- **Styling:** [e.g., Tailwind CSS]
- **Testing:** [e.g., Vitest + Testing Library]

## Commands
```bash
npm run dev       # Start development server (port 3000)
npm test          # Run test suite
npm run build     # Production build
npm run lint      # Lint + typecheck
npm run db:push   # Push schema changes
```

## Directory Structure
```
src/
├── app/          # Next.js App Router pages
├── components/   # Reusable UI components
├── lib/          # Shared utilities and helpers
├── api/          # API route handlers
└── db/           # Database schema and migrations
```

## Key Conventions
- [naming convention]
- [error handling pattern]
- [auth pattern]

## Environment Variables
Required in `.env.local`:
- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_SECRET` — Auth secret
```

---

## API Directory Template

```markdown
# API Routes

## Pattern
[RESTful | tRPC | GraphQL] — describe the pattern used

## Authentication
[How auth is checked — middleware? per-route? JWT? session?]

## Error Handling
[Standard error response format — example]

## Key Files
- `[entry point]` — [description]
- `[auth middleware]` — [description]

## Conventions
- [request validation approach]
- [response format]
```

---

## Components Directory Template

```markdown
# UI Components

## Pattern
[Functional React | Vue SFCs | etc.]

## Styling
[Tailwind | CSS Modules | styled-components — how classes are applied]

## Component Conventions
- [naming: PascalCase, kebab-case files?]
- [prop patterns: props interface naming?]
- [export style: named? default?]

## Testing
[How components are tested — Testing Library? Storybook?]
```

---

## Library/Utils Directory Template

```markdown
# Utilities & Helpers

## What Lives Here
[Description of what belongs in this directory]

## Key Files
- `[filename]` — [what it does]

## Conventions
- [how utilities are organized]
- [naming patterns]
```
