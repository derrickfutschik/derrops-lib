# Derrops Desktop Application - Implementation Plan

## Overview

Create a Tauri-based desktop application at `apps/derrops-desktop/` that shares code with the existing `apps/derrops-portal/` web application via a new shared package `packages/derrops-ui/`.

**Key Decisions:**

- Framework: Tauri 2.0 (Rust-based, ~3-5MB bundle)
- Backend: Supabase cloud (desktop as client, requires internet)
- Code Sharing: New `@derrops/ui` package for all shared components/pages
- Routing: HashRouter (required for desktop)
- Target Platforms: macOS (.dmg) and Windows (.msi)

## Architecture

```
packages/derrops-ui/          # NEW - Shared UI package
  ├── src/
  │   ├── components/        # All shadcn/ui components (from portal)
  │   ├── pages/            # All page components (from portal)
  │   ├── hooks/            # Custom React hooks (from portal)
  │   ├── lib/              # Utilities (from portal)
  │   ├── integrations/     # Supabase client (from portal)
  │   └── index.css         # Shared styles
  └── package.json

apps/derrops-portal/          # MODIFIED - Web app using shared package
  ├── src/
  │   ├── App.tsx           # BrowserRouter wrapper
  │   └── main.tsx          # Web entry point
  └── package.json          # Add @derrops/ui dependency

apps/derrops-desktop/         # NEW - Desktop app using shared package
  ├── src/
  │   ├── App.tsx           # HashRouter wrapper
  │   └── main.tsx          # Desktop entry point
  ├── src-tauri/            # Rust backend
  │   ├── src/main.rs
  │   ├── Cargo.toml
  │   └── tauri.conf.json
  └── package.json          # Add @derrops/ui dependency
```

## Implementation Phases

### Phase 1: Create Shared UI Package

**1.1 Create package structure:**

```bash
mkdir -p packages/derrops-ui/src
```

**1.2 Create package.json:**
File: `packages/derrops-ui/package.json`

- Set name: `@derrops/ui`
- Set version: `0.1.0`
- Set type: `module`
- Add all current portal dependencies (React, Radix UI, Supabase, etc.)
- Configure exports for pages, components, hooks, lib, styles

**1.3 Move shared code from portal:**

```bash
cp -r apps/derrops-portal/src/components packages/derrops-ui/src/
cp -r apps/derrops-portal/src/pages packages/derrops-ui/src/
cp -r apps/derrops-portal/src/hooks packages/derrops-ui/src/
cp -r apps/derrops-portal/src/lib packages/derrops-ui/src/
cp -r apps/derrops-portal/src/integrations packages/derrops-ui/src/
cp apps/derrops-portal/src/index.css packages/derrops-ui/src/
```

**1.4 Create index.ts:**
File: `packages/derrops-ui/src/index.ts`

- Export all pages (Landing, Auth, Dashboard, AddService, ServiceDetails, ApiTester, NotFound)
- Export commonly used components (Toaster, Sonner, TooltipProvider)
- Export utilities and integrations

**1.5 Create TypeScript config:**
Files: `packages/derrops-ui/tsconfig.json`, `packages/derrops-ui/tsconfig.node.json`

- Extend base config
- Set up path alias `@/*` → `./src/*`
- Configure for React 18

**1.6 Install dependencies:**

```bash
pnpm install
```

### Phase 2: Update Portal to Use Shared Package

**2.1 Update package.json:**
File: `apps/derrops-portal/package.json`

- Add dependency: `"@derrops/ui": "workspace:*"`
- Remove dependencies now in @derrops/ui (keep only portal-specific)

**2.2 Update App.tsx:**
File: `apps/derrops-portal/src/App.tsx`

- Change imports to use `@derrops/ui` for pages
- Keep BrowserRouter (web-specific)

**2.3 Update main.tsx:**
File: `apps/derrops-portal/src/main.tsx`

- Import styles from `@derrops/ui/styles`

**2.4 Remove moved files:**

```bash
cd apps/derrops-portal
rm -rf src/components src/pages src/hooks src/lib src/integrations
```

**2.5 Test portal:**

```bash
pnpm install
pnpm --filter @derrops/portal run build
pnpm --filter @derrops/portal run dev  # Verify at http://localhost:8080
```

### Phase 3: Set Up Tauri Desktop App

**3.1 Install Rust:**

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustc --version  # Verify
```

**3.2 Install platform dependencies:**
macOS: `xcode-select --install`

**3.3 Create desktop app directory:**

```bash
cd apps
mkdir derrops-desktop
cd derrops-desktop
npm create tauri-app@latest . -- --name derrops-desktop --template vanilla-ts --manager pnpm
```

**3.4 Create package.json:**
File: `apps/derrops-desktop/package.json`

- Scripts: dev, build, build:dev, preview, tauri
- Dependencies: @derrops/ui, @tanstack/react-query, react, react-dom, react-router-dom, @tauri-apps/api
- DevDependencies: @tauri-apps/cli, @vitejs/plugin-react-swc, tailwindcss, etc.

### Phase 4: Create Desktop Application Code

**4.1 Create App.tsx:**
File: `apps/derrops-desktop/src/App.tsx`

- Import pages from `@derrops/ui`
- Use **HashRouter** instead of BrowserRouter (critical difference)
- Same route structure as portal

**4.2 Create main.tsx:**
File: `apps/derrops-desktop/src/main.tsx`

- Import styles from `@derrops/ui/styles`
- Render App component

**4.3 Create index.html:**
File: `apps/derrops-desktop/index.html`

- Title: "Derrops Desktop"
- Script: `/src/main.tsx`

**4.4 Create vite.config.ts:**
File: `apps/derrops-desktop/vite.config.ts`

- Port: 1420 (Tauri expects fixed port)
- strictPort: true
- Configure HMR for Tauri
- Build targets: es2021, chrome100, safari13
- envPrefix: ["VITE_", "TAURI_"]

**4.5 Create tailwind.config.ts:**
File: `apps/derrops-desktop/tailwind.config.ts`

- Copy from portal
- Content: include both `./src/**/*.{ts,tsx}` and `../../packages/derrops-ui/src/**/*.{ts,tsx}`

**4.6 Create tsconfig.json:**
File: `apps/derrops-desktop/tsconfig.json`

- Similar to portal
- Add path aliases for @derrops/ui

### Phase 5: Configure Tauri Backend

**5.1 Configure tauri.conf.json:**
File: `apps/derrops-desktop/src-tauri/tauri.conf.json`

- productName: "Derrops"
- identifier: "com.derrops.desktop"
- version: "0.1.0"
- Window: 1280x800, min 1024x600, centered
- beforeDevCommand: "pnpm dev"
- beforeBuildCommand: "pnpm run build"
- devUrl: "http://localhost:1420"
- frontendDist: "../dist"
- CSP: Allow Supabase domains (https://omjpxenvfphdxkarmsxk.supabase.co, wss://omjpxenvfphdxkarmsxk.supabase.co)
- Bundle targets: ["dmg", "msi"]

**5.2 Configure Cargo.toml:**
File: `apps/derrops-desktop/src-tauri/Cargo.toml`

- name: "derrops-desktop"
- version: "0.1.0"
- edition: "2021"
- Dependencies: tauri v2, serde, serde_json
- Features: custom-protocol

**5.3 Create main.rs:**
File: `apps/derrops-desktop/src-tauri/src/main.rs`

- Basic Tauri app (default template is sufficient)

**5.4 Generate icons:**

```bash
cp apps/derrops-portal/public/favicon.png apps/derrops-desktop/app-icon.png
cd apps/derrops-desktop
pnpm tauri icon app-icon.png
```

### Phase 6: Environment Variables

**6.1 Create .env:**
File: `apps/derrops-desktop/.env`

```
VITE_SUPABASE_PROJECT_ID="omjpxenvfphdxkarmsxk"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGci..."
VITE_SUPABASE_URL="https://omjpxenvfphdxkarmsxk.supabase.co"
```

**6.2 Create .env.example:**
File: `apps/derrops-desktop/.env.example`

- Template with placeholder values
- Instructions on where to get credentials

**6.3 Update .gitignore:**
File: `apps/derrops-desktop/.gitignore`

- Ignore: node*modules, dist, src-tauri/target, .env, *.dmg, \_.msi

### Phase 7: Monorepo Integration

**7.1 Update root package.json:**
File: `package.json`
Add scripts:

- `dev:desktop`: `pnpm --filter derrops-desktop run dev`
- `build:desktop`: `pnpm --filter derrops-desktop run build`
- `build:desktop:dev`: `pnpm --filter derrops-desktop run build:dev`

**7.2 Update turbo.json:**
File: `turbo.json`

- Add `src-tauri/target/**` to build outputs
- Add Tauri env vars to env list

### Phase 8: Documentation

**8.1 Create README.md:**
File: `apps/derrops-desktop/README.md`

- Overview, tech stack, development setup
- Prerequisites (Node.js, Rust, platform tools)
- Scripts (dev, build, release)
- Project structure
- Environment variables
- Platform-specific notes
- Troubleshooting

**8.2 Create CLAUDE.md:**
File: `apps/derrops-desktop/CLAUDE.md`

- Architecture decisions
- Code sharing strategy
- Development workflow
- Tauri configuration details
- CSP and security notes
- Common tasks
- Integration with monorepo

**8.3 Update root CLAUDE.md:**
File: `CLAUDE.md`
Add section for derrops-desktop package with links to detailed docs

### Phase 9: Testing & Verification

**9.1 Test shared package:**

```bash
pnpm --filter @derrops/ui run typecheck
```

**9.2 Test portal:**

```bash
pnpm --filter @derrops/portal run build
pnpm --filter @derrops/portal run dev
```

- Verify at http://localhost:8080
- Test navigation, authentication, all features

**9.3 Test desktop dev mode:**

```bash
pnpm dev:desktop
```

- Desktop window should open
- Test all navigation and features
- Verify Supabase connection
- Test hot reload

**9.4 Test desktop build:**

```bash
pnpm build:desktop
```

- Verify DMG created (macOS): `src-tauri/target/release/bundle/dmg/`
- Verify MSI created (Windows): `src-tauri/target/release/bundle/msi/`
- Install and test built app

## Critical Files Summary

### New Files to Create

**Shared UI Package:**

- `packages/derrops-ui/package.json` - Package definition with all dependencies
- `packages/derrops-ui/src/index.ts` - Export all shared code
- `packages/derrops-ui/tsconfig.json` - TypeScript configuration

**Desktop App:**

- `apps/derrops-desktop/package.json` - Desktop dependencies and scripts
- `apps/derrops-desktop/src/App.tsx` - HashRouter configuration
- `apps/derrops-desktop/src/main.tsx` - Desktop entry point
- `apps/derrops-desktop/vite.config.ts` - Tauri-specific Vite config
- `apps/derrops-desktop/src-tauri/tauri.conf.json` - Tauri configuration (window, security, bundle)
- `apps/derrops-desktop/src-tauri/Cargo.toml` - Rust dependencies
- `apps/derrops-desktop/src-tauri/src/main.rs` - Rust backend
- `apps/derrops-desktop/.env` - Supabase credentials
- `apps/derrops-desktop/README.md` - User documentation
- `apps/derrops-desktop/CLAUDE.md` - Developer documentation

### Files to Modify

**Portal:**

- `apps/derrops-portal/package.json` - Add @derrops/ui dependency
- `apps/derrops-portal/src/App.tsx` - Import from @derrops/ui
- `apps/derrops-portal/src/main.tsx` - Import styles from @derrops/ui

**Monorepo Root:**

- `package.json` - Add desktop scripts
- `turbo.json` - Add Tauri outputs and env vars
- `CLAUDE.md` - Document new desktop app

### Files to Move

Move from `apps/derrops-portal/src/` to `packages/derrops-ui/src/`:

- `components/` directory
- `pages/` directory
- `hooks/` directory
- `lib/` directory
- `integrations/` directory
- `index.css` file

## Key Differences: Portal vs Desktop

| Aspect       | Portal (Web)  | Desktop (Tauri)              |
| ------------ | ------------- | ---------------------------- |
| Router       | BrowserRouter | HashRouter                   |
| URLs         | `/dashboard`  | `#/dashboard`                |
| Port         | 8080          | 1420                         |
| Build        | Vite → dist   | Vite → dist → Tauri bundle   |
| Output       | HTML/JS/CSS   | .dmg (macOS), .msi (Windows) |
| Distribution | AWS Amplify   | Direct download              |
| Size         | ~2.2MB        | ~3-5MB                       |

## Security Considerations

1. **API Keys**: Supabase publishable key is safe to bundle (designed for client-side use)
2. **CSP**: Content Security Policy restricts network access to Supabase domains only
3. **Local Storage**: Supabase auth uses localStorage - isolated per-app in Tauri
4. **HTTPS**: All Supabase connections use HTTPS/WSS
5. **Code Signing**: Optional but recommended for production distribution

## Success Criteria

- [ ] Shared @derrops/ui package builds without errors
- [ ] Portal continues to work exactly as before
- [ ] Desktop app launches in dev mode (`pnpm dev:desktop`)
- [ ] All routes navigate correctly in desktop app
- [ ] Supabase authentication works in desktop app
- [ ] Desktop app builds successfully for macOS (.dmg) and Windows (.msi)
- [ ] Built desktop app installs and runs on target platforms
- [ ] Hot reload works in development
- [ ] All UI components render correctly in desktop app

## Estimated Effort

- Phase 1-2 (Shared Package): 2-3 hours
- Phase 3-5 (Desktop Setup): 2-3 hours
- Phase 6-7 (Configuration): 1-2 hours
- Phase 8 (Documentation): 1-2 hours
- Phase 9 (Testing): 2-3 hours

**Total: 8-13 hours** (1-2 days)

## Future Enhancements

1. **Auto-updates**: Implement Tauri updater plugin
2. **Native menus**: Add File/Edit/View menus
3. **System tray**: Add menu bar icon
4. **Offline mode**: Cache data locally for offline use
5. **Native notifications**: System notifications for alerts
6. **File system access**: Save/load OpenAPI specs locally
7. **Code signing**: Set up certificates for production distribution
