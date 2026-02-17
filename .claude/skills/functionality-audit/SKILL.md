---
name: functionality-audit
description: Verify all UI buttons, forms, and features are properly connected to working backend logic — detect fake components, missing implementations, broken flows, and stub endpoints
disable-model-invocation: true
allowed-tools: Read, Grep, Glob
---

# Functionality Audit

You are a QA engineer performing a thorough **functionality completeness audit** of **Arcellite**. Your job is to verify that every interactive UI element is connected to a real, working backend implementation. No fake buttons, no stub endpoints, no dead features.

## Methodology

For each view/component, you must:
1. **Read the component** — find every button, form, link, and interactive element
2. **Trace the handler** — follow onClick/onSubmit to the function that calls the API
3. **Verify the API call** — confirm the endpoint exists in both dev (`vite.config.ts`) and prod (`server/routes/`)
4. **Verify the server logic** — confirm the handler does real work (not a stub/TODO)
5. **Check error handling** — verify failures are handled and shown to the user

Use [routes-matrix.md](routes-matrix.md) as your reference for the expected mappings.

## Components to Audit

### Desktop Views
| Component | Path | Key Features |
|-----------|------|-------------|
| FilesView | `components/views/files/FilesView.tsx` | Upload, download, delete, move, rename, create folder, category tabs, search |
| SharedView | `components/views/files/SharedView.tsx` | Connected apps display, file listing from external services |
| ChatView | `components/views/features/ChatView.tsx` | Send message, SSE streaming, action execution, conversation history, delete conversation |
| MyAppsView | `components/views/features/MyAppsView.tsx` | Connect/disconnect apps, OAuth flows, save configuration |
| DatabaseView | `components/views/system/DatabaseView.tsx` | Create/delete database, create/drop table, execute SQL, browse data |
| AccountSettingsView | `components/views/settings/AccountSettingsView.tsx` | Update profile, change avatar, change password, delete account |
| AIModelsView | `components/views/settings/AIModelsView.tsx` | Save API keys, test connection, select model |
| ServerView | `components/views/system/ServerView.tsx` | CPU/memory/network stats display |
| TrashView | `components/views/system/TrashView.tsx` | Restore, permanent delete, empty trash |
| RemovableStorageView | `components/views/system/RemovableStorageView.tsx` | Mount/unmount USB, browse USB files |
| ExportDataView | `components/views/system/ExportDataView.tsx` | Export JSON, CSV, backup ZIP |
| HelpSupportView | `components/views/features/HelpSupportView.tsx` | Submit support ticket |
| SecurityVaultView | `components/views/system/SecurityVaultView.tsx` | Security features |
| ActivityLogView | `components/views/system/ActivityLogView.tsx` | View activity history |
| StatsView | `components/views/system/StatsView.tsx` | Analytics display |
| SystemLogsView | `components/views/system/SystemLogsView.tsx` | System log viewer |
| AppearanceView | `components/views/settings/AppearanceView.tsx` | Theme settings |
| NotificationsView | `components/views/settings/NotificationsView.tsx` | Notification preferences |
| AISecurityView | `components/views/settings/AISecurityView.tsx` | AI security settings |
| APIKeysView | `components/views/settings/APIKeysView.tsx` | API key management |

### Mobile Views
| Component | Path |
|-----------|------|
| MobileApp | `components/mobile/MobileApp.tsx` |
| MobileOverview | `components/mobile/MobileOverview.tsx` |
| MobileFiles | `components/mobile/MobileFiles.tsx` |
| MobileGallery | `components/mobile/MobileGallery.tsx` |
| MobileChat | `components/mobile/MobileChat.tsx` |
| MobileMore | `components/mobile/MobileMore.tsx` |
| MobileFileViewer | `components/mobile/MobileFileViewer.tsx` |
| MobileUSBView | `components/mobile/MobileUSBView.tsx` |
| MobileDatabaseView | `components/mobile/MobileDatabaseView.tsx` |
| MobileMyAppsView | `components/mobile/MobileMyAppsView.tsx` |
| MobileSecurityVaultView | `components/mobile/MobileSecurityVaultView.tsx` |

### Auth & Onboarding
| Component | Path |
|-----------|------|
| AuthView | `components/auth/AuthView.tsx` |
| SetupWizard | `components/onboarding/SetupWizard.tsx` |

### Shared Components
| Component | Path |
|-----------|------|
| Header | `components/header/Header.tsx` |
| SearchBar | `components/header/SearchBar.tsx` |
| Sidebar | `components/sidebar/Sidebar.tsx` |
| UploadProgress | `components/common/UploadProgress.tsx` |

## What Constitutes a Failure

Flag as **BROKEN** if:
- A button has an onClick that does nothing (empty function, console.log only, or TODO comment)
- A form submits to an endpoint that doesn't exist
- An API endpoint returns hardcoded/fake data instead of real data
- A feature is visible in the UI but the backend logic is a stub
- An endpoint exists in dev mode (`vite.config.ts`) but not in production (`server/routes/`)
- An endpoint exists in production but not in dev mode
- A loading state is shown but the async operation never actually happens
- Error handling catches errors but silently swallows them with no user feedback

Flag as **INCOMPLETE** if:
- A feature is partially implemented (e.g., create works but delete doesn't)
- The UI shows options that aren't connected yet
- Data is displayed but not editable when it should be
- Pagination/filtering exists in UI but backend doesn't support it

Flag as **ORPHANED** if:
- Backend endpoints exist with no UI that calls them
- Frontend components exist but are never rendered/routed to
- API client functions exist but are never called

## Output Format

```
# Functionality Audit Report — Arcellite

## Summary
- Fully Working: X features
- Broken: X features
- Incomplete: X features
- Orphaned: X endpoints/components

## Feature Status Matrix

### FilesView
| Feature | UI Element | Handler | API Endpoint | Server Logic | Status |
|---------|-----------|---------|--------------|--------------|--------|
| Upload file | Upload button | handleUpload() | POST /api/files/upload | server/files.ts | WORKING |
| Delete file | Delete button | handleDelete() | POST /api/files/delete | server/files.ts | WORKING |
...

### [Each view gets its own table]

## Broken Features
### [FUNC-001] Feature Name
- **Component:** `path/to/component.tsx:line`
- **Issue:** Description of what's broken
- **Expected:** What should happen
- **Actual:** What actually happens (or doesn't)

## Incomplete Features
...

## Orphaned Code
...
```

Be thorough. Read every file. Trace every handler. Do not assume anything works — verify it.
