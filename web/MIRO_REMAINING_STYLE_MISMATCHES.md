# Miro 剩余样式不一致清单

生成日期：2026-05-12

修补状态：已完成本轮列出的所有残留项。

审计范围：`src/app`、`src/components`、`src/themes`、营销内容组装与 i18n 文案结构。

依据：`DESIGN.md` 中的 Miro 设计规范。重点核对项包括颜色 token、按钮/输入/徽章/表格/导航/footer 组件、动效、圆角、阴影、marketing hero、真实白板 mockup、pricing 结构，以及产品工作台中会继承通用组件的样式。

## 已完成项

- [x] 修复 `.marketing-shell` 的 `--bg-surface` 映射，恢复 Miro surface `#f7f8fa`，并移除 marketing 内重复硬编码色板。
- [x] 将 hero/story mockup 从工程仪表盘和 CSS 网格改为 Miro-style whiteboard frame、sticky notes、流程连线和 pastel board cards。
- [x] 将 pricing 对比表扩展为 4 个 section、80 行 dense comparison table，并补齐 section divider。
- [x] 将 logo wall 从纯文字占位改为 wordmark 风格项，保持 100px logo-wall item 高度。
- [x] 修复 footer column heading、app-store badge、review badge 的 typography、颜色和边框。
- [x] 收敛 shadow token 到 Miro elevation 0-4，普通 marketing panel 不再使用 mockup 阴影。
- [x] 移除 spring/bounce motion、`active:brightness-*` pressed state 和 `transition-all` 残留，统一到 150-200ms color/targeted transitions。
- [x] 修复 button pressed/link token：primary pressed 使用 charcoal，inline/action link 和 pricing featured border 使用 Miro brand blue。
- [x] 修复 Input、Select、DatePicker、ColorPicker、Textarea 的 focus/hover 颜色和 border-jump 问题。
- [x] 修复 Badge taxonomy，default badge 不再默认使用 full yellow，discount/tag 保留规范语义。
- [x] 修复 Checkbox、Switch、Tabs 的 checked/active/focus 颜色和动效。
- [x] 统一 micro-uppercase tracking 到 0.5px。
- [x] 收敛 light/dark theme 中的非 DESIGN 精确色和可漂移 `oklch(from ...)` semantic mix。
- [x] 修复 marketing nav、docsSoon tag、hero badge、story CTA、pricing tier badge、pricing discount badge、stats section 和 feature/story block 外壳。
- [x] 收敛 auth、console、project、share/internal 页面里的产品工作台样式债：大圆角、pastel 状态色、uppercase tracking、过重字重、spinner/link/action color 和泛化 transition。

## 保留例外

- [x] `font-mono` 继续用于 API method、path、JSON editor、request/response body、workflow snippets、版本号、ID、hex color 值。这是技术值的可读性例外。
- [x] `shadow-soft` 仅保留在 whiteboard mockup frame 上，符合 Miro mockup elevation。
- [x] `rounded-[1.75rem]` 与 `bg-block-*` 仅保留在 marketing sticky-note / pastel feature card 语义里，符合 Miro feature/sticky-note 视觉。
- [x] `font-semibold` 仅保留在 badge、micro-uppercase、app-store badge、discount badge 等 Miro 600 weight 语义里。

## 验证结果

- `pnpm exec tsc --noEmit --pretty false`：通过
- `pnpm lint`：通过
- `pnpm test -- --run`：54 tests passed
- `pnpm build`：通过
