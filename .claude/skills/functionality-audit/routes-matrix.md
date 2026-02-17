# Routes Matrix — Expected UI → API → Server Mappings

This matrix documents every expected connection between frontend actions and backend handlers.

## Auth Flow
| UI Action | Component | API Call | Route File | Server Handler |
|-----------|-----------|----------|------------|---------------|
| Register | AuthView | POST /api/auth/register | auth.routes.ts | auth.service.ts → register() |
| Login | AuthView | POST /api/auth/login | auth.routes.ts | auth.service.ts → login() |
| Verify Email | AuthView | POST /api/auth/verify-email | auth.routes.ts | auth.service.ts → verifyEmail() |
| Resend Code | AuthView | POST /api/auth/resend-code | auth.routes.ts | auth.service.ts → resendCode() |
| Get Current User | App.tsx | GET /api/auth/me | auth.routes.ts | auth.service.ts → getUser() |
| Logout | Header/ProfileDropdown | POST /api/auth/logout | auth.routes.ts | auth.service.ts → logout() |
| Update Profile | AccountSettingsView | PUT /api/auth/profile | auth.routes.ts | auth.service.ts → updateProfile() |
| Delete Account | AccountSettingsView | DELETE /api/auth/account | auth.routes.ts | auth.service.ts → deleteAccount() |
| List Sessions | AccountSettingsView | GET /api/auth/sessions | auth.routes.ts | auth.service.ts → listSessions() |
| Revoke Session | AccountSettingsView | DELETE /api/auth/sessions/:id | auth.routes.ts | auth.service.ts → revokeSession() |
| Get Settings | App.tsx | GET /api/auth/settings | auth.routes.ts | auth.service.ts → getSettings() |
| Save Settings | SettingsViews | PUT /api/auth/settings | auth.routes.ts | auth.service.ts → updateSettings() |
| Activity Log | ActivityLogView | GET /api/auth/activity | auth.routes.ts | auth.service.ts → getActivity() |
| Setup Status | App.tsx | GET /api/auth/setup-status | auth.routes.ts | auth.service.ts → setupStatus() |
| Complete Setup | SetupWizard | POST /api/auth/complete-setup | auth.routes.ts | auth.service.ts → completeSetup() |

## File Operations
| UI Action | Component | API Call | Route File | Server Handler |
|-----------|-----------|----------|------------|---------------|
| Upload Files | FilesView | POST /api/files/upload | files.routes.ts | files.ts → upload() |
| List Files | FilesView | GET /api/files/list | files.routes.ts | files.ts → list() |
| Serve File | FileViewer | GET /api/files/serve | files.routes.ts | files.ts → serve() |
| Download File | FileDetails | GET /api/files/download | files.routes.ts | files.ts → download() |
| Create Folder | FilesView | POST /api/files/mkdir | files.routes.ts | files.ts → mkdir() |
| Delete File | FilesView | POST /api/files/delete | files.routes.ts | files.ts → delete() |
| Move/Rename | FilesView | POST /api/files/move | files.routes.ts | files.ts → move() |
| Recent Files | Header/Overview | GET /api/files/recent | files.routes.ts | files.ts → recent() |
| Track Recent | FileViewer | POST /api/files/track-recent | files.routes.ts | files.ts → trackRecent() |
| List External | RemovableStorageView | GET /api/files/list-external | files.routes.ts | files.ts → listExternal() |
| Serve External | RemovableStorageView | GET /api/files/serve-external | files.routes.ts | files.ts → serveExternal() |

## Trash Operations
| UI Action | Component | API Call | Route File | Server Handler |
|-----------|-----------|----------|------------|---------------|
| List Trash | TrashView | GET /api/trash/list | trash.routes.ts | trash.ts → list() |
| Restore Item | TrashView | POST /api/trash/restore | trash.routes.ts | trash.ts → restore() |
| Delete Permanently | TrashView | POST /api/trash/delete | trash.routes.ts | trash.ts → delete() |
| Empty Trash | TrashView | POST /api/trash/empty | trash.routes.ts | trash.ts → empty() |
| Move to Trash | FilesView | POST /api/trash/move-to-trash | trash.routes.ts | trash.ts → moveToTrash() |

## Database Operations
| UI Action | Component | API Call | Route File | Server Handler |
|-----------|-----------|----------|------------|---------------|
| List Databases | DatabaseView | GET /api/databases/list | databases.routes.ts | databases.ts → list() |
| Get Database | DatabaseView | GET /api/databases/get | databases.routes.ts | databases.ts → get() |
| Create Database | DatabaseView | POST /api/databases/create | databases.routes.ts | databases.ts → create() |
| Delete Database | DatabaseView | POST /api/databases/delete | databases.routes.ts | databases.ts → delete() |
| List Tables | DatabaseView | GET /api/databases/tables | databases.routes.ts | databases.ts → tables() |
| Get Columns | DatabaseView | GET /api/databases/columns | databases.routes.ts | databases.ts → columns() |
| Get Data | DatabaseView | GET /api/databases/data | databases.routes.ts | databases.ts → data() |
| Create Table | DatabaseView | POST /api/databases/create-table | databases.routes.ts | databases.ts → createTable() |
| Drop Table | DatabaseView | POST /api/databases/drop-table | databases.routes.ts | databases.ts → dropTable() |
| Execute Query | DatabaseView | POST /api/databases/query | databases.routes.ts | databases.ts → query() |

## AI Chat
| UI Action | Component | API Call | Route File | Server Handler |
|-----------|-----------|----------|------------|---------------|
| Send Message | ChatView | POST /api/ai/chat | ai.routes.ts | ai.ts → chat() |
| Save API Keys | AIModelsView | POST /api/ai/keys/save | ai.routes.ts | ai.ts → saveKeys() |
| Load API Keys | AIModelsView | GET /api/ai/keys/load | ai.routes.ts | ai.ts → loadKeys() |
| Test Connection | AIModelsView | POST /api/ai/keys/test | ai.routes.ts | ai.ts → testKeys() |

## Chat History
| UI Action | Component | API Call | Route File | Server Handler |
|-----------|-----------|----------|------------|---------------|
| List Conversations | ChatView | GET /api/chat/conversations | chat.routes.ts | chat handler |
| Create Conversation | ChatView | POST /api/chat/conversations | chat.routes.ts | chat handler |
| Load Conversation | ChatView | GET /api/chat/conversations/:id | chat.routes.ts | chat handler |
| Delete Conversation | ChatView | DELETE /api/chat/conversations/:id | chat.routes.ts | chat handler |
| Save Message | ChatView | POST /api/chat/messages | chat.routes.ts | chat handler |
| Generate Title | ChatView | POST /api/chat/generate-title | chat.routes.ts | chat handler |

## System
| UI Action | Component | API Call | Route File | Server Handler |
|-----------|-----------|----------|------------|---------------|
| Storage Info | Sidebar/StorageWidget | GET /api/system/storage | server/index.ts | storage.ts |
| System Stats | ServerView | GET /api/system/stats | server/index.ts | stats.ts |
| Mount Device | RemovableStorageView | POST /api/system/mount | server/index.ts | storage.ts |
| Unmount Device | RemovableStorageView | POST /api/system/unmount | server/index.ts | storage.ts |
| Analytics | StatsView | GET /api/analytics | analytics.routes.ts | analytics.ts |
| Notifications | Header | GET /api/notifications | server/index.ts | notifications.ts |

## Transfer
| UI Action | Component | API Call | Route File | Server Handler |
|-----------|-----------|----------|------------|---------------|
| Prepare Transfer | SetupWizard/USB | POST /api/transfer/prepare | transfer.routes.ts | transfer.service.ts |
| Transfer Status | SetupWizard/USB | GET /api/transfer/status | transfer.routes.ts | transfer.service.ts |
| Detect Transfer | SetupWizard | GET /api/transfer/detect | transfer.routes.ts | transfer.service.ts |
| Import Transfer | SetupWizard | POST /api/transfer/import | transfer.routes.ts | transfer.service.ts |

## Export
| UI Action | Component | API Call | Route File | Server Handler |
|-----------|-----------|----------|------------|---------------|
| Export JSON | ExportDataView | GET /api/export/json | export.routes.ts | export handler |
| Export CSV | ExportDataView | GET /api/export/csv | export.routes.ts | export handler |
| Export Backup | ExportDataView | GET /api/export/backup | export.routes.ts | export handler |

## Support
| UI Action | Component | API Call | Route File | Server Handler |
|-----------|-----------|----------|------------|---------------|
| Submit Ticket | HelpSupportView | POST /api/support/submit | support.routes.ts | support handler |
