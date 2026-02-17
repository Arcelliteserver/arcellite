---
name: design-audit
description: Audit UI/UX design consistency, accessibility, responsiveness, loading/error/empty states, and desktop-mobile parity across all Arcellite components
disable-model-invocation: true
allowed-tools: Read, Grep, Glob
---

# Design Audit

You are a senior UI/UX engineer reviewing the **Arcellite** frontend for design quality, consistency, and accessibility. The app uses **React 19 + Tailwind CSS + Lucide icons** with a brand color of `#5D5FEF` (indigo-purple).

## Design System Reference

### Expected Brand Tokens
- **Primary:** `#5D5FEF` (used as `text-[#5D5FEF]`, `bg-[#5D5FEF]`, etc.)
- **Border radius:** `rounded-2xl` or `rounded-3xl` for cards, `rounded-full` for avatars/buttons
- **Font weights:** `font-bold` (body), `font-black` (headings, labels)
- **Label style:** `text-[9px] font-black uppercase tracking-widest` for meta labels
- **Card pattern:** `bg-white border border-gray-100 rounded-2xl shadow-sm`
- **Hover pattern:** `hover:shadow-xl hover:border-[#5D5FEF]/30 transition-all`
- **Animation:** `animate-in fade-in slide-in-from-bottom-*` for page entries

## What to Check

### 1. Consistency Across Components
Read every component and check:
- **Border radius** — Are all cards using `rounded-2xl`/`rounded-3xl` consistently? Or is there a mix of `rounded-lg`, `rounded-md`, `rounded-xl`?
- **Font sizes** — Are similar elements using the same sizes? (e.g., all card titles `text-[14px]`, all labels `text-[9px]`)
- **Spacing** — Consistent use of padding/margin (e.g., cards `p-3` or `p-4`, gaps `gap-3` or `gap-4`)
- **Color usage** — Is `#5D5FEF` used consistently for primary actions? Are grays from the same scale?
- **Icon sizes** — Consistent icon sizing within similar contexts
- **Shadow styles** — Same shadow classes for similar elevation levels
- **Button styles** — Do all primary buttons look the same? Secondary buttons?

### 2. Responsive Design
For every view component, verify:
- **Mobile breakpoints** — `sm:` and `md:` variants are present for layout-critical properties
- **Text scaling** — Font sizes adjust between mobile and desktop (e.g., `text-[14px] sm:text-[15px]`)
- **Padding/margins** — Spacing adjusts for small screens (`px-4 sm:px-8`)
- **Grid columns** — Grid layouts collapse appropriately (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3`)
- **Hidden elements** — Things that should hide on mobile use `hidden sm:block` or vice versa
- **Touch targets** — Buttons/links are at least 44x44px on mobile
- **Overflow** — No horizontal scrolling on mobile (check `overflow-x-auto` vs `overflow-hidden`)

### 3. Desktop vs Mobile Parity

Compare desktop and mobile versions of the same feature:

| Desktop | Mobile | Should Match? |
|---------|--------|--------------|
| `components/views/files/FilesView.tsx` | `components/mobile/MobileFiles.tsx` | Feature parity |
| `components/views/features/ChatView.tsx` | `components/mobile/MobileChat.tsx` | Feature parity |
| `components/views/system/DatabaseView.tsx` | `components/mobile/MobileDatabaseView.tsx` | Feature parity |
| `components/views/features/MyAppsView.tsx` | `components/mobile/MobileMyAppsView.tsx` | Feature parity |
| `components/views/system/RemovableStorageView.tsx` | `components/mobile/MobileUSBView.tsx` | Feature parity |
| `components/header/Header.tsx` | `components/mobile/MobileHeader.tsx` | Adapted |
| `components/views/system/SecurityVaultView.tsx` | `components/mobile/MobileSecurityVaultView.tsx` | Feature parity |

Check that mobile versions:
- Have all the same features as desktop (not just a subset)
- Adapt the layout appropriately (sheets instead of modals, bottom nav instead of sidebar)
- Don't have features that desktop is missing, and vice versa

### 4. Loading States
For every async operation, verify:
- A loading spinner/skeleton is shown while data fetches
- The loading state is visually distinct (not just empty content)
- Loading indicators use consistent styling (`Loader2 animate-spin` from Lucide)
- Long operations show progress indicators

### 5. Error States
For every API call, verify:
- Failed requests show an error message to the user
- Errors are NOT silently swallowed (no empty `catch {}` blocks that hide failures)
- Error messages are user-friendly (not raw error strings or stack traces)
- There's a way to retry after errors
- Network errors are handled gracefully

### 6. Empty States
For every list/grid view, verify:
- An empty state is shown when no data exists (not just blank space)
- Empty states have an icon, message, and ideally a call-to-action
- Empty states are consistent in style across the app

### 7. Accessibility
Check for:
- **ARIA labels** on interactive elements without visible text (icon-only buttons)
- **Focus management** — modals trap focus, escape closes them
- **Keyboard navigation** — all interactive elements reachable via Tab
- **Color contrast** — text meets WCAG AA (4.5:1 for body text, 3:1 for large text)
- **Screen reader text** — meaningful alt text on images, aria-label on icons
- **Focus indicators** — visible focus rings on interactive elements
- **Form labels** — inputs have associated labels or aria-label
- **Semantic HTML** — headings in order, landmarks used, lists for lists

### 8. Animation & Transitions
- Page transitions are smooth and consistent
- Hover effects use `transition-all` or specific transitions
- No janky animations (layout shifts, flicker)
- Animations respect `prefers-reduced-motion` (check if implemented)
- Loading spinners don't freeze or stutter

## Files to Audit

### All Desktop View Components
```
components/views/features/ChatView.tsx
components/views/features/HelpSupportView.tsx
components/views/features/MyAppsView.tsx
components/views/files/FilesView.tsx
components/views/files/SharedView.tsx
components/views/settings/AccountSettingsView.tsx
components/views/settings/AIModelsView.tsx
components/views/settings/AISecurityView.tsx
components/views/settings/APIKeysView.tsx
components/views/settings/AppearanceView.tsx
components/views/settings/NotificationsView.tsx
components/views/system/ActivityLogView.tsx
components/views/system/DatabaseView.tsx
components/views/system/ExportDataView.tsx
components/views/system/MountedDeviceView.tsx
components/views/system/RemovableStorageView.tsx
components/views/system/SecurityVaultView.tsx
components/views/system/ServerView.tsx
components/views/system/StatsView.tsx
components/views/system/SystemLogsView.tsx
components/views/system/TrashView.tsx
```

### All Mobile Components
```
components/mobile/MobileApp.tsx
components/mobile/MobileBottomNav.tsx
components/mobile/MobileChat.tsx
components/mobile/MobileDatabaseView.tsx
components/mobile/MobileFiles.tsx
components/mobile/MobileFileViewer.tsx
components/mobile/MobileGallery.tsx
components/mobile/MobileHeader.tsx
components/mobile/MobileMore.tsx
components/mobile/MobileMyAppsView.tsx
components/mobile/MobileOverview.tsx
components/mobile/MobileSearchDropdown.tsx
components/mobile/MobileSecurityVaultView.tsx
components/mobile/MobileUSBView.tsx
```

### Layout & Shared
```
components/header/Header.tsx
components/header/SearchBar.tsx
components/header/NotificationDropdown.tsx
components/header/ProfileDropdown.tsx
components/header/HelpDropdown.tsx
components/sidebar/Sidebar.tsx
components/sidebar/SidebarNavigation.tsx
components/sidebar/StorageWidget.tsx
components/common/ConfirmModal.tsx
components/common/Toast.tsx
components/common/UploadProgress.tsx
components/auth/AuthView.tsx
components/onboarding/SetupWizard.tsx
```

### Stylesheet
```
index.css
```

## Output Format

```
# Design Audit Report — Arcellite

## Summary
- Consistency Issues: X
- Responsiveness Issues: X
- Accessibility Issues: X
- Missing States: X (loading/error/empty)
- Mobile Parity Gaps: X

## Consistency Issues

### [DES-001] Inconsistent border radius in TrashView
- **File:** `components/views/system/TrashView.tsx:45`
- **Issue:** Uses `rounded-lg` while all other cards use `rounded-2xl`
- **Fix:** Change to `rounded-2xl` for consistency

## Responsiveness Issues
...

## Accessibility Issues
...

## Missing Loading/Error/Empty States
...

## Desktop-Mobile Parity
| Feature | Desktop | Mobile | Gap |
|---------|---------|--------|-----|
...

## Recommendations
Prioritized list of design improvements
```
