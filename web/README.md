# Kest Platform - Vite Architecture

## 📁 Project Structure

```
web-vite-demo/ 
├── src/
│   ├── services/          # API services (axios)
│   │   ├── http.ts        # HTTP client with interceptors
│   │   └── project.service.ts
│   ├── hooks/             # Custom React hooks
│   │   └── use-projects.ts
│   ├── components/        # React components
│   │   ├── ui/           # Reusable UI components
│   │   ├── features/     # Feature-specific components
│   │   └── common/       # Common components
│   ├── utils/            # Utility functions
│   │   └── index.ts      # cn(), debounce(), etc.
│   ├── types/            # TypeScript definitions
│   │   └── index.ts
│   ├── store/            # Zustand stores
│   ├── config/           # Configuration
│   │   └── query-client.ts  # TanStack Query config
│   ├── constants/        # Constants and enums
│   ├── App.tsx           # Main app with routes
│   └── main.tsx          # Entry point
├── vite.config.ts        # Vite configuration
├── tailwind.config.js    # Tailwind CSS
└── tsconfig.json         # TypeScript config
```

## 🛠️ Technology Stack

- **Build Tool**: Vite 5
- **Framework**: React 18
- **Language**: TypeScript
- **Router**: React Router 6
- **Data Fetching**: TanStack Query (React Query)
- **HTTP Client**: Axios
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Validation**: Zod

## 🚀 Key Features

### 1. Path Aliases

```typescript
import { http } from '@/services/http';
import { useProjects } from '@/hooks/use-projects';
import { cn } from '@/utils';
```

### 2. TanStack Query Optimizations

- Stale time: 1 minute
- Cache time: 5 minutes
- Smart refetch strategy
- Optimistic updates
- Query invalidation

### 3. HTTP Client

- Request/response interceptors
- Auto token injection
- Error handling
- Type-safe API calls

### 4. Service Layer Pattern

```typescript
// services/project.service.ts
export const projectService = {
  list: (page, pageSize) => { },
  get: (id) => { },
  create: (data) => { },
  update: (id, data) => { },
  delete: (id) => { },
};
```

### 5. Custom Hooks

```typescript
// hooks/use-projects.ts
export function useProjects(page, pageSize) {
  return useQuery({
    queryKey: ['projects', { page, pageSize }],
    queryFn: () => projectService.list(page, pageSize),
  });
}
```

## 📦 Build & Deploy

```bash
# Development
npm run dev

# Build
npm run build  # → dist/

# Preview production build
npm run preview
```

### Embed in Go

```go
//go:embed web-vite-demo/dist
var webFS embed.FS

func main() {
    staticFS, _ := fs.Sub(webFS, "web-vite-demo/dist")
    http.Handle("/", http.FileServer(http.FS(staticFS)))
}
```

## 🎯 Migration from Next.js

### What to Keep

- ✅ `components/ui/*` - shadcn/ui components
- ✅ `utils/*` - Utility functions
- ✅ `hooks/*` - Custom hooks
- ✅ `types/*` - TypeScript types
- ✅ `services/*` - API services

### What to Rewrite

- Router: Next.js App Router → React Router
- Data fetching: Server Components → TanStack Query
- Layouts: Next.js layouts → React components

## 📈 Performance

- Bundle size: ~194KB (vs Next.js ~500KB+)
- Build time: <3s (vs Next.js 20-40s)
- Hot reload: <50ms
- Tree-shaking: Automatic
- Code splitting: Per route

## 🔧 Development

### Add New Feature

1. Create service: `services/feature.service.ts`
2. Create hooks: `hooks/use-feature.ts`
3. Create components: `components/features/FeatureComponent.tsx`
4. Add route: `App.tsx`

### Configuration

- API URL: `VITE_API_URL` in `.env`
- Production example: copy `.env.production.example` and set `VITE_API_URL` to your backend domain (e.g. `https://api.kest.dev`)
- Dev default API: `http://localhost:8025` (set `VITE_API_URL` if different)
- Path aliases: `vite.config.ts` + `tsconfig.json`
