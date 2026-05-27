# Kest Agent Rules

## Workspace Terminology

`workspace` is the only current product term for the user-facing workspace concept. Do not introduce new `project` or `projects` naming in feature work.

Before changing frontend or backend feature code, run:

```bash
node scripts/check-workspace-terminology.mjs
```

Run it again before committing.

Rules:

- New UI copy, i18n keys, route constants, service methods, DTOs, hooks, components, API wrappers, and backend routes must use `workspace`.
- Do not add new `/project` or `/projects` frontend routes. If browser testing lands on `/project`, report it as a legacy route issue instead of treating it as a successful workspace verification.
- Existing `project` code is legacy. If a change must touch a legacy file, keep the edit tightly scoped and do not expand the legacy naming surface.
- If a terminology check fails, rename the new code to `workspace`. Do not update the baseline unless the change is an explicit legacy migration decision.

