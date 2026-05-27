# AI Agent Guide

> This document is designed for AI coding assistants (Cursor, Windsurf, GitHub Copilot, etc.) to understand and work with this codebase effectively.

## Kest Workspace Terminology

Read `../AGENTS.md` before feature work. New user-facing business code must use `workspace`, not `project` or `projects`.

Before and after frontend feature changes, run:

```bash
pnpm terminology
```

## Project Overview

**LlamaFront AI Scaffold** - A production-ready Next.js scaffold optimized for rapid AI-assisted development.

| Tech | Version | Purpose |
|------|---------|---------|
| Next.js | 16.x | App Router, RSC, API Routes |
| React | 19.x | UI Library |
| TypeScript | 5.x | Type Safety |
| Tailwind CSS | 4.x | Styling |
| shadcn/ui | Latest | UI Components |
| Zustand | 5.x | State Management |
| React Query | 5.x | Server State |
| next-intl | 4.x | i18n |

## Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Public auth route group (login, register)
│   ├── (normal)/           # Protected route group
│   │   └── console/        # Admin dashboard
│   ├── (site)/             # Public site route group
│   ├── api/                # API Route Handlers (Mock endpoints)
│   │   └── auth/           # Auth endpoints (Mock by default)
├── components/
│   ├── ui/                 # shadcn/ui primitives (DO NOT MODIFY)
│   └── features/           # Business feature components
├── config/                 # App configuration
├── constants/              # Route constants, enums
├── hooks/                  # Custom React hooks
├── http/                   # HTTP client (axios wrapper)
├── i18n/                   # Internationalization
│   ├── config.ts           # Locale config + ENV variables
│   ├── translations.ts     # Unified translation hooks (useT, getT)
│   └── modules/            # Per-module translations (common, auth, etc.)
├── providers/              # React context providers
├── services/               # API service layer (Zod validated)
├── store/                  # Zustand stores (dumb state only)
├── test/                   # Test utilities and setup (unit tests in src/test)
├── themes/                 # Design tokens (OKLCH, CSS variables)
├── types/                  # TypeScript type definitions
└── utils/                  # Pure utility functions
```

## Architecture Patterns

### 1. Mock API Architecture

All API calls go through Next.js Route Handlers under `/api/*`:

```
Browser → /api/auth/* → Mock handlers (Next.js API routes)
```

**Benefits:**
- No external dependencies for development
- httpOnly cookie sessions (secure)
- Fast local development without backend

### 2. Authentication Flow

**Token Modes (configured via `NEXT_PUBLIC_AUTH_TOKEN_MODE`):**

| Mode | Description |
|------|-------------|
| `basic` | Single access token, no refresh |
| `refresh` | Access + refresh token pair (default) |

**Auth Endpoints (Mock API):**

```
# Mock Backend (in src/app/api/auth)
POST /api/auth/login     → Mock login (admin@example.com / admin123)
POST /api/auth/register  → Mock user registration
GET  /api/auth/me        → Get current user
POST /api/auth/logout    → Clear cookies
GET  /api/auth/setup-status    → Get setup status
POST /api/auth/setup           → Initial system setup
GET  /api/auth/system-features → Get feature flags
```

**Route Groups:**
- `(auth)/*` - Public auth pages (login, register)
- `(normal)/*` - Protected routes (requires AuthGuard/Middleware)
- `(site)/*` - Public pages

**Protecting Routes:**

```typescript
// app/(normal)/layout.tsx
import { AuthGuard } from '@/components/auth-guard';

export default function NormalLayout({ children }) {
  return <AuthGuard>{children}</AuthGuard>;
}
```

### 3. State Management

- **Auth state**: `src/store/auth-store.ts` (Zustand + persist)
  - Stores user data, system features, and authentication status.
  - Contains state and setters; async initialization logic is included for convenience.
- **Auth actions**: `src/hooks/use-auth.ts` (React Query)
  - Handles `login`, `register`, and `logout`.
  - Includes built-in toast notifications and redirection.
  - Usage: `const { mutate: login } = useLogin();`
- **Server state**: React Query for all API data.
- **UI state**: `src/store/ui-store.ts` (Zustand).
- **Auth config**: `src/config/auth.ts` (token modes, routes).

### 4. Internationalization (i18n)

The project uses `next-intl` with a unified translation pattern that supports both dot notation and namespace-based access.

#### Type System

The i18n system provides full TypeScript type safety through:
- **`AllTranslationKeys`**: Union type of all valid dot-notation keys
- **`ScopedTranslations<P>`**: Type-safe scoped translator for a specific prefix path
- **`UnifiedTranslations`**: Combined type that supports both dot notation and namespace accessors

#### Client Components
```tsx
import { useT } from '@/i18n';

function MyComponent() {
  const t = useT();
  return (
    <div>
      {/* Dot notation (recommended) */}
      <button>{t('common.save')}</button>
      
      {/* Namespace-based (backward compatible) */}
      <button>{t.common('save')}</button>
    </div>
  );
}
```

#### Server Components
```tsx
import { getT } from '@/i18n';

export default async function Page() {
  const t = await getT();
  return <h1>{t('common.loading')}</h1>;
}
```

#### Scoped Translations
For components with many translations from a single namespace:
```tsx
function SettingsPage() {
  const t = useT('settings');  // Scoped to 'settings' namespace
  return <h1>{t('title')}</h1>;  // settings.title
}
```

#### Available Modules

| Module | Description |
|--------|-------------|
| `common` | Common UI text (buttons, labels, messages) |
| `auth` | Authentication-related text |
| `nav` | Navigation labels |
| `settings` | Settings page translations |
| `errors` | Error messages |
| `metadata` | Page titles and SEO metadata |
| `dashboard` | Dashboard-specific translations |
| `test` | Testing translations |

#### Key Files

| File | Purpose |
|------|---------|
| `src/i18n/config.ts` | Locale configuration and settings |
| `src/i18n/translations.ts` | `useT` and `getT` implementation with types |
| `src/i18n/loader.ts` | Dynamic module loading and `AVAILABLE_MODULES` |
| `src/i18n/modules/index.ts` | Static type generation from modules |
| `src/i18n/README.md` | Detailed documentation with examples |

**Type Safety:** Invalid keys will cause TypeScript errors at compile time.

## Code Conventions

### Must Follow

- **Package manager**: `pnpm` only
- **Comments**: English only
- **Tests**: Place in `src/test` directory
- **Hot reload**: Do NOT restart dev server (auto-updates)

### 5. Theme System (Design Tokens & OKLCH)

The project uses a structured Design Token system based on OKLCH and CSS variables, layered for better governance and maintainability.

#### Layered Architecture:
1.  **Primitives (`src/themes/primitives.css`)**: Base color palette (e.g., `--neutral-500`, `--blue-500`). **Do not use directly.**
2.  **Semantic Tokens (`light.css` / `dark.css`)**: Functional naming based on purpose.
    - **Backgrounds**: `bg-canvas`, `bg-surface`, `bg-subtle`.
    - **Foregrounds**: `text-main`, `text-subtle`, `text-muted`.
    - **Borders**: `border-main`, `border-subtle`, `border-strong`.
    - **Brand**: `brand-main`, `brand-subtle`, `brand-strong`.
    - **States**: `success`, `warning`, `error`, `info`, `highlight`.

#### Usage in Tailwind (Strict Mode):
Always prefer semantic classes over raw color values.
```tsx
// Using Semantic Tokens
<div className="bg-bg-surface text-text-main border-border-subtle shadow-md p-4 rounded-lg">
  <h1 className="text-brand">Heading</h1>
  <p className="text-text-subtle">Description using subtle text.</p>
</div>

// Opacity modifiers work on all semantic tokens
<div className="border-brand/60 bg-brand-subtle/50">
  Integrated opacity support
</div>
```

### File Naming

- Components: `kebab-case.tsx` (e.g., `login-form.tsx`)
- Hooks: `use-*.ts` (e.g., `use-mobile.ts`)
- Types: `*.ts` in `types/` directory
- Utils: `*.ts` in `utils/` directory

### Import Order

```typescript
// 1. React/Next imports
import { useState } from 'react';
import Link from 'next/link';

// 2. Third-party libraries
import { useQuery } from '@tanstack/react-query';

// 3. Internal imports (absolute paths)
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth-store';
```

## Environment Variables

The project uses a **Strict Environment Variable** system to ensure type safety and prevent runtime errors.

### 1. Single Source of Truth
All environment variables MUST be defined, validated, and exported from `src/config/env.ts`.

**❌ DO NOT:**
```typescript
const apiUrl = process.env.NEXT_PUBLIC_API_URL; // Unsafe, untyped
```

**✅ DO:**
```typescript
import { env } from '@/config/env';

const apiUrl = env.NEXT_PUBLIC_API_URL; // Typed, validated
```

### 2. Validation (Zod)
We use `zod` to valid environment variables at runtime. If a required variable is missing, the app will fail to start only with a clear error message.

### 3. Supported Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | No | `/api` | Base URL for API requests. |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | No | - | Google Analytics ID. |
| `NODE_ENV` | No | `development` | App environment (`development` \| `production` \| `test`). |

To add a new variable:
1. Add it to `.env.local`
2. Add validation schema to `src/config/env.ts`
3. Export it in `env.ts`


## Tooling & Utility Standards (ARW)

To maintain a lean and consistent codebase, AI agents MUST follow the **"Search First"** rule before implementing any new utility or hook.

### 1. The "Search First" Rule
Before writing a new utility function or React hook, you **MUST**:
1.  **Check `src/utils/index.ts`**: Scan the exports to see if a similar utility already exists.
2.  **Check `src/hooks/`**: Browse the file names and signatures for existing logic.
3.  **Check Approved Libraries**: Verify if the functionality is provided by:
    - `date-fns`: For all date manipulations.
    - `lodash-es`: For complex object/array operations (use sparingly, prefer native).
    - `validator`: For complex string validation.

### 2. Implementation Priority
Follow this order of preference:
1.  **Native Web APIs**: `Intl`, `URL`, `Crypto`, etc.
2.  **Existing Project Utils/Hooks**: Reuse what's already in `src/utils` or `src/hooks`.
3.  **Approved Third-Party Libraries**: Use existing dependencies from `package.json`.
4.  **Custom Implementation**: Only if the above options are exhausted.

### 3. Utility & Hook Discovery Tags
Use these tags in JSDoc headers to aid AI discovery:
- `@util`: Marks a pure utility function.
- `@hook`: Marks a reusable React hook.

### 4. Contract for New Additions
- **Utils**: Must be pure functions in `src/utils/[category].ts`, exported via `index.ts`, with tests in `__tests__/`.
- **Hooks**: Must be in `src/hooks/use-[purpose].ts` and follow React Hook rules.

## Common Tasks

### Adding a New Page

1. Create file in `src/app/(site)/page-name/page.tsx`
2. Add route to `src/constants/routes.ts`
3. Add translations to `src/i18n/modules/[module]/zh-Hans.ts` and other locales

### Adding a New API Endpoint

1. Create folder in `src/app/api/endpoint-name/`
2. Add `route.ts` with HTTP method handlers
3. Use `cookies()` from `next/headers` for auth if needed

### Adding a New Component

1. **UI primitives** → Use shadcn/ui: `npx shadcn@latest add [component]`. These always go in `src/components/ui/`.
2. **Feature components** → Create in `src/components/features/[module]/`. 
   - **CRITICAL**: Do NOT place components in `app/` (route) directories. All reusable or module-specific components MUST be centralized in `src/components/`.
   - Organise by functional module (e.g., `src/components/features/console/`).
3. **Common components** → Generic, non-business specific components should be in `src/components/common/`.

#### Atomic Component Contract

To ensure engineering rigor and performance, all components MUST follow these rules:

- **Named Exports**: Always use named exports. Do NOT use `export default`.
  - `export function ComponentName({ ... }: ComponentNameProps) { ... }`
- **Strict Typing**: Always define an interface for props named `[ComponentName]Props`.
- **RSC First Strategy**: 
  - Components are **Server Components** by default.
  - If a component needs interactivity (hooks or events), extract the interactive logic into a **small, leaf-level Client Component** (marked with `'use client'`). 
  - Avoid turning large feature components into Client Components.
- **Zero Hardcoded Strings**: All user-facing text must use the `useT` hook for i18n.
- **Icon Consistency**: Use `lucide-react`. Standardize size using Tailwind's `size-4` (16px) or `size-5` (20px) for consistent alignment.

#### Performance Optimization Rules

Following [Vercel React Best Practices](file:///.agent/skills/react-best-practices/SKILL.md) for optimal performance:

- **Dynamic Imports** (`bundle-dynamic-imports`): Use `next/dynamic` for components > 50KB (charts, editors, rich-text, maps):
  ```tsx
  const HeavyEditor = dynamic(() => import('./heavy-editor'), {
    loading: () => <Skeleton className="h-64" />,
  });
  ```

- **React.memo** (`rerender-memo`): Use for expensive child components that receive stable props:
  ```tsx
  export const ExpensiveList = React.memo(function ExpensiveList({ items }: Props) {
    // Heavy rendering logic
  });
  ```

- **Conditional Rendering** (`rendering-conditional-render`): Use ternary operators, not `&&`:
  ```tsx
  // ✅ Correct
  {condition ? <Component /> : null}
  
  // ❌ Avoid (may render '0' or 'false')
  {condition && <Component />}
  ```

- **RSC Caching** (`server-cache-react`): Use `React.cache()` for per-request deduplication in Server Components:
  ```tsx
  import { cache } from 'react';
  
  export const getUser = cache(async (id: string) => {
    return await db.user.findUnique({ where: { id } });
  });
  ```

#### Component Annotation Standard (CAS)

All components MUST include a standardized JSDoc header for discovery and AI-assisted reuse:

```typescript
/**
 * @component [Formal Name]
 * @category [UI | Feature | Common]
 * @status [Stable | Beta | Experimental]
 * @description [Concise purpose]
 * @usage [When/How to use]
 * @example
 * <ComponentName prop={value} />
 */
```

### Adding a New Data Module (Service-Hook-Type Pattern)

All data handling must follow the strict **Service-Hook-Type** layered architecture to ensure separation of concerns and type safety.

#### 1. Define Types (`src/types/*.ts`)
All data structures (Domain models, DTOs, Query schemas) must be strictly typed.

```typescript
export interface ExampleItem { id: string; title: string; status: 'active' | 'inactive'; }
export interface UpdateExampleRequest { title?: string; status?: 'active' | 'inactive'; }
```

#### 2. Implement Stateless Service (`src/services/*.ts`)
Services are pure functional objects.
- **Stateless**: They do not hold state or use hooks.
- **Dedicated Clients**: Use the appropriate HTTP client for the feature.
- **Simple**: Just wrappers around named `request` instances.

**Standard Pattern: Named Request Instances**
Define specialized clients in `src/http/request.ts` to manage multiple base URLs (e.g., standard API vs. file service).

```typescript
// 1. Define instances in src/http/request.ts
export const request = createRequest({ baseURL: env.API_URL }); // Default
export const fileRequest = createRequest({ baseURL: env.FILE_URL, timeout: 60000 }); // Specialized

// 2. Map Services to the correct client
// src/services/user.ts
import request from '@/http/request'; 
export const userService = { get: () => request.get('/user') };

// src/services/file.ts
import { fileRequest } from '@/http/request';
export const fileService = { upload: (file) => fileRequest.post('/upload', file) };
```

#### 3. Implement Encapsulated Hooks (`src/hooks/*.ts`)
Hooks manage React Query state and side effects.

**Standard Pattern: Full CRUD Optimistic Updates**
Provide immediate UI feedback and handle errors via **Refetch-on-Failure**.

```typescript
// 1. Key Factory
export const exampleKeys = {
  all: ['examples'] as const,
  lists: () => [...exampleKeys.all, 'list'] as const,
  detail: (id: string) => [...exampleKeys.all, 'detail', id] as const,
};

// 2. Query Hooks
export const useExample = (id: string) => useQuery({
  queryKey: exampleKeys.detail(id),
  queryFn: () => exampleService.get(id),
});

// 3. Mutation Hooks (Optimistic Template)
export function useUpdateExample() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string, data: UpdateExampleRequest }) => 
      exampleService.update(id, data),
    
    // Step 1: Push optimistic update to UI
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: exampleKeys.detail(id) });
      const prev = queryClient.getQueryData(exampleKeys.detail(id));
      if (prev) queryClient.setQueryData(exampleKeys.detail(id), { ...prev as any, ...data });
      return { prev };
    },
    
    // Step 2: Rollback via Refetch on failure
    onError: (err, { id }) => {
      queryClient.invalidateQueries({ queryKey: exampleKeys.detail(id) });
      toast.error(err.message);
    },
    
    // Step 3: Final synchronization
    onSettled: (data, err, { id }) => {
      queryClient.invalidateQueries({ queryKey: exampleKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: exampleKeys.lists() });
    }
  });
}
```

**Key Strategies:**
- **Cancel outgoing refetches** in `onMutate` to prevent race conditions.
- **Rollback via Invalidation**: Simpler and more robust than manual state restoration.
- **Always Sync**: Final invalidation in `onSettled` ensures local state perfect alignment with the server.

## API Error Handling

The project uses a standardized error code system to ensure consistency between the frontend and backend.

### 1. Error Response Format
All error responses from the backend (BFF or mock) MUST follow this format:
```json
{
  "error": "Human-readable error message",
  "code": "CATEGORY_DESCRIPTION"
}
```

### 2. Error Code Clusters
Error codes follow the format `[CATEGORY]_[DESCRIPTION]`.

| Category | Prefix | Description | Examples |
|----------|--------|-------------|----------|
| **System** | `SYS_` | Infrastructural or unexpected errors | `SYS_SERVER_ERROR`, `SYS_TIMEOUT` |
| **Auth** | `AUTH_` | Authentication and authorization issues | `AUTH_TOKEN_EXPIRED`, `AUTH_FORBIDDEN` |
| **Validation** | `VAL_` | Input parameter or schema validation | `VAL_MISSING_FIELD`, `VAL_INVALID_PARAMS` |
| **Business** | `BIZ_` | Business logic constraints | `BIZ_RESOURCE_NOT_FOUND`, `BIZ_ALREADY_EXISTS` |

### 3. Usage in Code
- **Constants**: Always use `ErrorCode` from `@/http/codes` to check for specific errors.
- **Handling**: Errors are automatically caught by `HttpClient` and passed to `handleError`. Use `skipErrorHandler: true` in request config to handle errors manually in components or hooks.

## API Response Format

## Do NOT

- Modify files in `src/components/ui/` (shadcn/ui managed)
- Use `localStorage` for tokens (use httpOnly cookies)
- Add business-specific logic to scaffold (keep generic)
- Create test files in business modules (use `tests/`)
- Use Chinese in code comments
- Generate `.sh` or `.md` files unless explicitly requested

## Quick Reference

| Action | Command |
|--------|---------|
| Install deps | `pnpm install` |
| Dev server | `pnpm dev` |
| Build | `pnpm build` |
| Type check | `pnpm type-check` |
| Lint | `pnpm lint` |
| Format | `pnpm format` |
| Add UI component | `npx shadcn@latest add [name]` |
