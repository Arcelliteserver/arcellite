---
name: bug-hunt
description: Hunt for real bugs — race conditions, memory leaks, stale closures, unhandled errors, dead code, state management issues, and other code defects in the Arcellite codebase
disable-model-invocation: true
allowed-tools: Read, Grep, Glob
---

# Bug Hunt

You are a senior software engineer hunting for **real bugs** in the **Arcellite** codebase (React 19 + Node.js + PostgreSQL). Focus on bugs that will actually break things at runtime — not style preferences or theoretical concerns.

## Bug Categories

### 1. Race Conditions (HIGH PRIORITY)
Search for patterns that indicate race conditions:

**React state races:**
- Multiple `useEffect` hooks that both update shared state
- `useEffect` that reads state from closure instead of using refs for latest value
- State updates that depend on other state that hasn't updated yet
- `setState` inside `useEffect` that triggers re-renders and cascading updates

**Server-side races:**
- Concurrent file operations without locking
- Read-then-write patterns without transactions (SELECT then UPDATE)
- Multiple async operations that assume sequential execution

**Files to check:**
- `components/views/features/MyAppsView.tsx` — previous race condition in connectedAppIds
- `App.tsx` — complex state management, many useEffects
- `server/files.ts` — concurrent file operations
- `server/databases.ts` — database operations
- `server/ai.ts` — streaming + action execution

### 2. Memory Leaks
Search for:
- `setInterval` / `setTimeout` without cleanup in useEffect return
- Event listeners added but never removed
- WebSocket/SSE connections not closed on unmount
- Subscriptions not unsubscribed
- Large data stored in state that should be cleared
- Refs holding stale DOM references

**Pattern to grep for:**
```
setInterval
setTimeout
addEventListener
new EventSource
new WebSocket
```

**Files to check:**
- All components with polling (ServerView, notifications)
- `components/views/features/ChatView.tsx` — SSE streaming
- `components/mobile/MobileChat.tsx` — SSE streaming
- `components/pwa/InstallPrompt.tsx` — event listeners
- `server/notifications.ts` — notification polling/checking

### 3. Unhandled Errors
Search for:
- `catch {}` blocks with no error handling (swallowed errors)
- `catch` that logs but doesn't inform the user
- Missing `.catch()` on promises
- `async` functions called without `await` and no `.catch()`
- API calls without try/catch
- Missing error boundaries in React

**Grep patterns:**
```
catch {}
catch {
catch(e) {}
catch (e) {}
catch (_)
// Non-critical
```

**Important distinction:** Some empty catches are intentional (non-critical background operations). Flag only those where the user should be notified of failure.

### 4. Stale Closures in React Hooks
Search for:
- `useCallback` with missing dependencies
- `useEffect` with missing dependencies
- `useMemo` with missing dependencies
- Event handlers defined inside render that capture stale state
- `setInterval` inside useEffect that reads state from closure (should use refs or functional updates)

**Files to check (largest/most complex components):**
- `App.tsx`
- `components/views/features/ChatView.tsx`
- `components/views/files/FilesView.tsx`
- `components/views/system/DatabaseView.tsx`
- `components/views/features/MyAppsView.tsx`
- `components/mobile/MobileApp.tsx`
- `components/mobile/MobileFiles.tsx`
- `components/mobile/MobileChat.tsx`

### 5. Null/Undefined Access
Search for:
- Optional chaining that should be checked earlier (`obj?.prop?.method()` chains)
- Array access without bounds checking
- Object destructuring without defaults on nullable values
- `.split()`, `.map()`, `.filter()` on potentially undefined values
- JSON.parse without try/catch

### 6. Dead Code & Unused Imports
Search for:
- Imported modules/functions never used
- Functions defined but never called
- Variables assigned but never read
- Components exported but never imported anywhere
- CSS classes defined but never used
- Commented-out code blocks (large ones)
- Feature flags or conditionals that are always true/false

### 7. TypeScript Safety Issues
Search for:
- `any` type usage that hides real type errors
- Type assertions (`as`) that could be wrong at runtime
- Missing return types on functions that could return different types
- `@ts-ignore` or `@ts-expect-error` comments
- Non-null assertions (`!`) on possibly null values

### 8. State Management Bugs
- State updates that don't use functional form when depending on previous state
  - Wrong: `setCount(count + 1)` inside callbacks
  - Right: `setCount(prev => prev + 1)`
- Derived state stored in useState instead of computed from source
- Props drilled through many layers that could get stale
- State reset not happening when it should (e.g., switching views)

### 9. Server-Side Bugs
- Database connections not released back to pool (missing `client.release()`)
- Streams not properly closed on error
- File handles not closed
- Response not sent on all code paths (hanging requests)
- Missing Content-Type headers on responses
- Buffer concatenation without size limits (DoS vector)
- `JSON.parse` on request body without try/catch

**Files to check:**
```
server/index.ts
server/files.ts
server/databases.ts
server/ai.ts
server/stats.ts
server/storage.ts
server/trash.ts
server/analytics.ts
server/notifications.ts
server/services/auth.service.ts
server/services/email.service.ts
server/services/transfer.service.ts
server/db/connection.ts
server/routes/*.ts
```

### 10. Browser Compatibility
- APIs that don't work in all modern browsers
- CSS features without fallbacks
- ES2022+ features that might need transpiling

## Output Format

```
# Bug Hunt Report — Arcellite

## Summary
- Critical Bugs: X
- High Priority: X
- Medium Priority: X
- Low Priority: X
- Code Smells: X

## Critical Bugs

### [BUG-001] Race condition in XYZ
- **Severity:** Critical
- **File:** `path/to/file.tsx:line`
- **Description:** What happens and when
- **Reproduction:** Steps or conditions that trigger the bug
- **Code:**
  ```typescript
  // The problematic code
  ```
- **Fix:**
  ```typescript
  // The corrected code
  ```

## High Priority Bugs
...

## Code Smells
(Things that aren't bugs yet but will become bugs)
...
```

Focus on **real, reproducible bugs**. Every finding must include the exact code snippet and a concrete fix. Do NOT flag style issues or theoretical concerns — only things that will actually break.
