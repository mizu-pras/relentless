# AGENTS.md Quality Criteria

## Scoring Rubric (100 points total)

### Tech Stack & Conventions (20 points)
- **18-20:** Tech stack, key libraries, naming conventions, and file organization all documented
- **14-17:** Tech stack documented, some conventions missing
- **8-13:** Only framework mentioned, no conventions
- **0-7:** Missing or vague

**Check for:** Framework, language, key libraries, naming conventions (camelCase, kebab-case, etc.), file organization pattern

### Architecture Clarity (20 points)
- **18-20:** Clear explanation of directory purpose, component relationships, data flow
- **14-17:** Main directories explained, some relationships unclear
- **8-13:** Basic structure mentioned, no relationships
- **0-7:** No architecture info

**Check for:** What each major directory does, how components relate, entry points

### Commands & Workflows (20 points)
- **18-20:** All build/test/dev/deploy commands present, copy-pasteable
- **14-17:** Main commands present, some missing
- **8-13:** Some commands, but incomplete or wrong
- **0-7:** No commands

**Check for:** `npm run dev`, `npm test`, `npm run build`, `npm run lint`, migration commands, deploy commands

### Non-Obvious Patterns (15 points)
- **13-15:** Key gotchas, quirks, and non-obvious patterns documented
- **9-12:** Some patterns documented
- **4-8:** Only obvious patterns
- **0-3:** No patterns documented

**Check for:** Authentication patterns, error handling approach, state management patterns, API conventions, anything a developer would need to discover by reading code

### Conciseness (15 points)
- **13-15:** Dense, useful, no padding
- **9-12:** Mostly useful with minor padding
- **4-8:** Noticeable verbose sections or generic advice
- **0-3:** Mostly generic/verbose

**Anti-patterns:** Generic best practices, obvious statements ("use meaningful variable names"), restating what's obvious from the code

### Currency (10 points)
- **9-10:** Accurately reflects current codebase
- **6-8:** Mostly accurate, minor outdated items
- **3-5:** Some outdated information
- **0-2:** Significantly outdated

**Check for:** File paths that still exist, command names that still work, dependencies that are still used

## Grades

| Score | Grade | Meaning |
|-------|-------|---------|
| 90-100 | A | Excellent — minimal changes needed |
| 70-89 | B | Good — minor gaps |
| 50-69 | C | Adequate — missing key sections |
| 30-49 | D | Poor — sparse or outdated |
| 0-29 | F | Failing — needs full rewrite |
