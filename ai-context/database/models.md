# Database Modeling - Entity Dictionary

PostgreSQL is accessed through Prisma ORM. Tenant-scoped operational entities use `tenantId` in Prisma and `tenant_id` in the database for logical isolation. `SUPER_ADMIN` is a platform-level role and can exist without `tenantId`.

Physical database identifiers follow English `snake_case`, `tb_`-prefixed singular table names and explicit foreign keys. Prisma models follow PascalCase and fields follow camelCase, using `@map` / `@@map` to preserve SQL naming conventions.

---

## Global Enums

| Prisma enum | Database enum | Values | Description |
|---|---|---|---|
| `Plan` | `plan` | `FREE`, `BASIC`, `PROFESSIONAL` | Tenant subscription plan level. |
| `SubscriptionStatus` | `subscription_status` | `ACTIVE`, `TRIAL`, `SUSPENDED`, `CANCELLED` | Tenant billing/operational state. |
| `Role` | `role` | `ADMIN`, `STAFF`, `BASIC`, `SUPER_ADMIN` | Global user access role. |
| `AuthProvider` | `auth_provider` | `GOOGLE`, `APPLE` | External identity provider linked to a user. Only Google is functional today. |
| `UserStatus` | `user_status` | `PENDING`, `ACTIVE`, `DISABLED` | User account activation/access lifecycle. |
| `MinistryRole` | `ministry_role` | `LEADER`, `ASSISTANT_LEADER`, `MEMBER` | Contextual role inside a ministry. |
| `MemberStatus` | `member_status` | `ACTIVE`, `INACTIVE`, `VISITOR`, `TRANSFERRED` | Member lifecycle state. |
| `ScheduleStatus` | `schedule_status` | `DRAFT`, `PUBLISHED`, `CLOSED` | Schedule lifecycle state. |
| `ConfirmationStatus` | `confirmation_status` | `PENDING`, `CONFIRMED`, `DECLINED` | Assignment confirmation response. |
| `EventType` | `event_type` | `GENERAL`, `MINISTRY`, `INTERNAL_MEETING` | Calendar event classification. |
| `EventStatus` | `event_status` | `SCHEDULED`, `COMPLETED`, `CANCELLED` | Calendar event state. |
| `AuditAction` | `audit_action` | `CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `LOGOUT` | Audited action type. |

UI-friendly labels belong to frontend/i18n, not database enum values.

---

## Entities

### 1. Tenant (`tb_tenant`)

Represents an organization using the platform.

- `id`
- `name`
- `slug`
- `plan`
- `subscriptionStatus` / `subscription_status`
- `memberLimit` / `member_limit`
- `active` / `is_active`
- `email`
- `phone`
- `language`
- `logoUrl` / `logo_url`
- `logoKey` / `logo_key`
- `pwaShortName` / `pwa_short_name`
- `pwaIconUrl` / `pwa_icon_url`, URL publica da variante 512x512
- `pwaIconKey` / `pwa_icon_key`, chave da variante principal no storage
- `pwaUpdatedAt` / `pwa_updated_at`, versao da identidade publicada do aplicativo
- `createdAt` / `created_at`
- `updatedAt` / `updated_at`

Rules:

- A identidade personalizada do PWA so fica completa quando `pwaShortName`, `pwaIconUrl`, `pwaIconKey` e `pwaUpdatedAt` estao preenchidos.
- Os campos sao opcionais; tenants sem configuracao completa usam integralmente a identidade OneElo.
- O icone do PWA e independente da logo institucional.

### 2. User (`tb_user`)

Represents login credentials and global access permissions. It does not replace `Member`.

- `id`
- `tenantId` / `tenant_id`, nullable for `SUPER_ADMIN`
- `memberId` / `member_id`, optional link to `Member`
- `name`
- `email`
- `telefoneLogin` / `login_phone`, opcional e unico globalmente
- `passwordHash` / `password_hash`
- `role`
- `status`: `PENDING`, `ACTIVE`, or `DISABLED`
- `active` / `is_active`
- `activationTokenHash` / `activation_token_hash`
- `activationExpiresAt` / `activation_expires_at`
- `activationCreatedAt` / `activation_created_at`
- `activatedAt` / `activated_at`
- `onboardingCompletedAt` / `onboarding_completed_at`
- `createdAt` / `created_at`
- `updatedAt` / `updated_at`

Rules:

- `status` is the source of truth for account activation and daily login.
- `active` remains during the transition for compatibility with existing screens and services.
- `passwordHash` is nullable so a pending user can activate using Google without creating a password.
- An `ACTIVE` tenant user must have a password or at least one active `UserAuthProvider`.
- Activation links persist only a token hash; the raw token is returned only when creating/regenerating the link.
- Activating a user clears all activation-token fields and fills `activatedAt`.
- `onboardingCompletedAt` remains null until the user completes the final onboarding action. The migration and development seed do not backfill it.
- `telefoneLogin` is an authentication credential stored in E.164 format. It is independent from `Member.mobilePhone` and is never backfilled or synchronized automatically.
- Password login may resolve the same active user by `email` or `telefoneLogin`; social login continues to resolve `UserAuthProvider`.

### 3. UserAuthProvider (`tb_user_auth_provider`)

Represents an external identity linked to an existing internal user. It never creates an operational user by itself.

- `id`
- `userId` / `user_id`
- `provider`: `GOOGLE` or `APPLE`
- `providerUserId` / `provider_user_id`
- `email`
- `emailVerified` / `email_verified`
- `displayName` / `display_name`
- `avatarUrl` / `avatar_url`
- `active` / `is_active`
- `linkedAt` / `linked_at`
- `lastLoginAt` / `last_login_at`
- `revokedAt` / `revoked_at`
- `createdAt` / `created_at`
- `updatedAt` / `updated_at`

Rules:

- Unique external identity: `[provider, providerUserId]`.
- At most one identity of each provider per user: `[userId, provider]`.
- Daily social login requires both an active provider link and an `ACTIVE` user.
- The last active provider cannot be unlinked when the user has no password.
- Provider access tokens are not persisted by this model.

### 4. Member (`tb_member`)

Represents a person in a tenant. A member may exist without login credentials.

- `id`
- `tenantId` / `tenant_id`
- `name`
- `mobilePhone` / `mobile_phone`
- `email`
- `birthDate` / `birth_date`
- `status` / `member_status`
- `notes`
- `deletedAt` / `deleted_at`
- `createdAt` / `created_at`
- `updatedAt` / `updated_at`

### 5. Label (`tb_label`)

Custom segmentation label for members.

- `id`
- `tenantId` / `tenant_id`
- `name`
- `colorHex` / `color_hex`
- Unique per tenant: `[tenantId, name]`.

### 6. MemberLabel (`tb_member_label`)

Many-to-many relation between members and labels.

- `memberId` / `member_id`
- `labelId` / `label_id`
- Composite key: `[memberId, labelId]`.

### 7. Ministry (`tb_ministry`)

Represents an area of service in a tenant.

- `id`
- `tenantId` / `tenant_id`
- `name`
- `description`
- `active` / `is_active`
- `createdAt` / `created_at`
- `updatedAt` / `updated_at`

### 8. MinistryMember (`tb_ministry_member`)

Connects members to ministries and stores contextual leadership.

- `ministryId` / `ministry_id`
- `memberId` / `member_id`
- `role`: `LEADER`, `ASSISTANT_LEADER`, or `MEMBER`
- Composite key: `[ministryId, memberId]`.

Rules:

- There is no separate `MinistryLeader` entity as source of truth.
- Leadership is resolved through `MinistryMember.role`.
- A `User` with `role = BASIC` gains contextual permissions when its linked `memberId` has `LEADER` or `ASSISTANT_LEADER` in the ministry.

### 9. MinistryPosition (`tb_ministry_position`)

Defines service positions available inside a ministry.

- `id`
- `ministryId` / `ministry_id`
- `name`
- `description`
- `colorHex` / `color_hex`
- `order` / `display_order`
- Unique per ministry: `[ministryId, name]`.

### 10. MinistryMemberPosition (`tb_ministry_member_position`)

Defines which positions a member can serve in a ministry.

- `ministryId` / `ministry_id`
- `memberId` / `member_id`
- `positionId` / `position_id`

### 11. Schedule (`tb_schedule`)

Monthly service schedule linked to a ministry.

- `id`
- `tenantId` / `tenant_id`
- `ministryId` / `ministry_id`
- `month`
- `year`
- `status` / `schedule_status`
- `notes`
- `createdAt` / `created_at`
- `updatedAt` / `updated_at`
- Unique per ministry/month/year: `[ministryId, month, year]`.

### 12. ScheduleDay (`tb_schedule_day`)

Individual day inside a schedule.

- `id`
- `scheduleId` / `schedule_id`
- `scheduledDate` / `scheduled_date`
- `title`
- `eventId` / `event_id`
- `notes`
- `order` / `display_order`

Rules:

- An event can appear at most once in the same schedule: unique `[scheduleId, eventId]` when `eventId` is filled.
- Multiple manual days with `eventId = null` remain valid in the same schedule.

### 13. ScheduleDayPositionHidden (`tb_schedule_day_position_hidden`)

Defines positions hidden for a specific schedule day.

- `dayId` / `day_id`
- `positionId` / `position_id`
- Composite key: `[dayId, positionId]`.

### 14. ScheduleAssignment (`tb_schedule_assignment`)

Individual member assignment in a schedule day and ministry position.

- `id`
- `scheduleDayId` / `schedule_day_id`
- `memberId` / `member_id`
- `userId` / `user_id`
- `ministryPositionId` / `ministry_position_id`
- `confirmationStatus` / `confirmation_status`
- `notes`

### 15. Event (`tb_event`)

Calendar event.

- `id`
- `tenantId` / `tenant_id`
- `title`
- `description`
- `type` / `event_type`
- `startAt` / `start_at`
- `endAt` / `end_at`
- `location`
- `status` / `event_status`
- `createdAt` / `created_at`
- `updatedAt` / `updated_at`

### 16. EventMinistry (`tb_event_ministry`)

Many-to-many relation between events and ministries.

- `eventId` / `event_id`
- `ministryId` / `ministry_id`
- `requerEscala` / `requires_schedule`, defaults to `false`
- Composite key: `[eventId, ministryId]`.

Rules:

- `GENERAL` events can exist with or without ministries linked; these relations are operational metadata and do not restrict general visibility.
- `MINISTRY` events use ministries as organization/filter metadata.
- `INTERNAL_MEETING` events can be linked to none, one, or many ministries.
- `requerEscala` distinguishes a ministry involved in the event from one that must prepare a schedule.
- Existing relations and legacy API payloads default to `requerEscala = false`; there is no automatic backfill to `true`.
- The frontend should render ministry names only when the relation exists.

### 17. AuditLog (`tb_audit_log`)

Historical record of sensitive mutations and events.

- `id`
- `tenantId` / `tenant_id`
- `userId` / `user_id`
- `entity`
- `entityId` / `entity_id`
- `action`
- `payloadBefore` / `payload_before`
- `payloadAfter` / `payload_after`
- `ipAddress` / `ip_address`
- `createdAt` / `created_at`

### 18. Lead (`tb_lead`)

Public acquisition/contact lead.

- `id`
- `name`
- `email`
- `phone`
- `message`
- `createdAt` / `created_at`

---

## References

- `ai-context/backlog/permissions-matrix.md`
- `ai-context/business-rules/validation-rules.md`
- `ai-context/plans/ods-domain-rename-phase-1-definition.md`
- `ai-context/plans/ods-domain-rename-phase-2-migration-blueprint.md`
