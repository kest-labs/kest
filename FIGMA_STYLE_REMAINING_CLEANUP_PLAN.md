# Figma Style Remaining Cleanup Plan

## Summary

本计划覆盖当前 Figma 风格重构后仍未系统检查或仍有残留命中的区域。目标是继续按小批次清理 shared UI primitives、少量 auth/project 零散残留，以及确认哪些扫描命中属于合理保留项。

本计划只描述后续执行步骤；创建本文件不需要 commit 或 push。

## Current Baseline

- 当前分支：`codex/figma-style-incremental`
- 最近已完成批次：`1031902 style: finish shared surface cleanup`
- 最近已验证命令：
  - `pnpm lint`
  - `pnpm type-check`
  - `pnpm build`
  - smoke: `/`, `/login`, `/i18n-test`
- 当前已知可保留命中：
  - `web/src/app/globals.css` 中的 shadow token 定义
  - `web/src/components/ui/chart.tsx` 中图例色块的 `rounded-[2px]`

## Remaining Work

### Batch 1: Shared Overlay Primitives

**Scope**

- `web/src/components/ui/dropdown-menu.tsx`
- `web/src/components/ui/dialog.tsx`
- `web/src/components/ui/sheet.tsx`
- `web/src/components/ui/drawer.tsx`

**Known Residuals**

- `shadow-premium`
- `backdrop-blur-*`
- `bg-popover/95`
- `bg-background/95`
- `border-border/60`
- overlay close buttons using `bg-muted/50`

**Target Direction**

- Use `rounded-lg` or `rounded-md` according to existing primitive scale.
- Prefer `border-border-main`, `bg-popover`, `bg-bg-canvas`, `bg-bg-surface`.
- Replace heavy or glassy overlay shadows with `shadow-soft` or `shadow-none`.
- Keep scrim opacity only where it is semantically an overlay backdrop, but remove unnecessary blur unless required by UX.
- Preserve Radix behavior, component props, animation states, focus behavior, and accessibility semantics.

**Suggested Commit**

`style: simplify shared overlay primitives`

### Batch 2: Date, Calendar, And Table Primitives

**Scope**

- `web/src/components/ui/date-picker.tsx`
- `web/src/components/ui/calendar.tsx`
- `web/src/components/ui/table.tsx`

**Known Residuals**

- `bg-muted/*`
- `border-border/*`
- `backdrop-blur-2xl`
- time picker panel translucency
- table header/row muted surfaces

**Target Direction**

- Move date/time picker panels to flat token surfaces:
  - `bg-bg-canvas`
  - `bg-bg-surface`
  - `border-border-main`
- Keep selected date/time states as black primary pills or filled rounded controls.
- Keep hover states subtle and token based.
- Keep table density and row behavior unchanged.

**Suggested Commit**

`style: align date and table primitives`

### Batch 3: Auth And Site Stragglers

**Scope**

- `web/src/app/(auth)/layout.tsx`
- `web/src/components/features/site/home/marketing-navbar.tsx`

**Known Residuals**

- `text-neutral-950/75` in auth hero subtitle
- `backdrop-blur-xl` in marketing navbar sticky state

**Target Direction**

- Replace auth subtitle with `text-text-subtle`.
- Decide whether marketing navbar blur is intentional sticky chrome. If not, replace with flat `bg-bg-canvas` plus `border-border-main`.
- Do not change auth routes, forms, language switcher, or navigation behavior.

**Suggested Commit**

`style: clean auth and site stragglers`

### Batch 4: Project Inverse State Review

**Scope**

- `web/src/components/features/project/project-dashboard-page.tsx`
- `web/src/components/features/project/project-workspace-layout.tsx`

**Known Residuals**

- `bg-white/16`
- `border-white/24`
- `hover:bg-white/16`

**Decision Needed**

These are currently used as inverse active/hover states on dark or primary surfaces. They can be treated as intentional if the design language allows translucent inverse states, or replaced with tokenized inverse classes if the goal is strict scan cleanliness.

**Target Direction If Changed**

- Prefer tokenized inverse classes:
  - `bg-text-inverse/16`
  - `border-text-inverse/24`
  - `hover:bg-text-inverse/16`
- Keep active state visibility and contrast intact.

**Suggested Commit**

`style: tokenise project inverse states`

## False Positive Rules

Keep these unless there is a separate design-token refactor request:

- `globals.css` shadow variable definitions, because they are token declarations rather than page usage.
- `chart.tsx` `rounded-[2px]` indicators, because they are small chart swatches and not component/card radius drift.
- Semantic destructive/error classes on alerts, buttons, validation messages, and destructive menu items.
- Modal scrim color such as `bg-black/60` when it is clearly an overlay backdrop.

## Scan Commands

Use this broad scan before and after each batch:

```bash
rg -n "rounded-\[|rounded-2xl|rounded-3xl|bg-white/|bg-slate|text-slate|border-slate|bg-zinc|text-zinc|border-zinc|bg-blue|text-blue|border-blue|bg-indigo|text-indigo|border-indigo|bg-purple|text-purple|border-purple|bg-rose|border-rose|text-rose|shadow-md|shadow-lg|shadow-xl|shadow-2xl|bg-gradient|bg-linear" web/src
```

Use this secondary scan for softer shared UI drift:

```bash
rg -n "shadow-premium|shadow-tooltip|backdrop-blur|bg-popover/|border-border/|bg-muted/|text-neutral-950|border-black/|bg-white/" web/src
```

## Per-Batch Workflow

1. Run `git status --short --branch`.
2. Inspect only the files listed in the current batch.
3. Apply minimal visual-only class changes.
4. Re-run the scan commands and classify remaining hits.
5. Run validation:
   - `pnpm lint`
   - `pnpm type-check`
   - `pnpm build`
6. For route-affecting batches, start dev server and smoke test relevant routes.
7. If implementation is requested for the batch, commit and push that batch separately.

## Suggested Validation Routes

- Shared overlay primitives:
  - `/`
  - `/login`
  - `/project`
  - `/project/1`
- Date/calendar/table primitives:
  - `/project/1/environments`
  - `/project/1/test-cases`
  - `/project/1/categories`
- Auth/site stragglers:
  - `/`
  - `/login`
  - `/register`
  - `/forgot-password`
- Project inverse states:
  - `/project`
  - `/project/1`

## Estimated Remaining Effort

- Shared overlay primitives: 1 small batch
- Date/calendar/table primitives: 1 small batch
- Auth/site stragglers: 1 tiny batch
- Project inverse state review: 1 optional tiny batch

Total: about 3 required batches plus 1 optional strict-token cleanup batch.
