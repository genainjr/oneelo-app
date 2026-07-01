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
| `MinistryRole` | `ministry_role` | `LEADER`, `ASSISTANT_LEADER`, `MEMBER` | Contextual role inside a ministry. |
| `MemberStatus` | `member_status` | `ACTIVE`, `INACTIVE`, `VISITOR`, `TRANSFERRED` | Member lifecycle state. |
| `ScheduleStatus` | `schedule_status` | `DRAFT`, `PUBLISHED`, `CLOSED` | Schedule lifecycle state. |
| `ConfirmationStatus` | `confirmation_status` | `PENDING`, `CONFIRMED`, `DECLINED` | Assignment confirmation response. |
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
- `createdAt` / `created_at`
- `updatedAt` / `updated_at`

### 2. User (`tb_user`)

Represents login credentials and global access permissions. It does not replace `Member`.

- `id`
- `tenantId` / `tenant_id`, nullable for `SUPER_ADMIN`
- `memberId` / `member_id`, optional link to `Member`
- `name`
- `email`
- `passwordHash` / `password_hash`
- `role`
- `active` / `is_active`
- `createdAt` / `created_at`
- `updatedAt` / `updated_at`

### 3. Member (`tb_member`)

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

### 4. Label (`tb_label`)

Custom segmentation label for members.

- `id`
- `tenantId` / `tenant_id`
- `name`
- `colorHex` / `color_hex`
- Unique per tenant: `[tenantId, name]`.

### 5. MemberLabel (`tb_member_label`)

Many-to-many relation between members and labels.

- `memberId` / `member_id`
- `labelId` / `label_id`
- Composite key: `[memberId, labelId]`.

### 6. Ministry (`tb_ministry`)

Represents an area of service in a tenant.

- `id`
- `tenantId` / `tenant_id`
- `name`
- `description`
- `active` / `is_active`
- `createdAt` / `created_at`
- `updatedAt` / `updated_at`

### 7. MinistryMember (`tb_ministry_member`)

Connects members to ministries and stores contextual leadership.

- `ministryId` / `ministry_id`
- `memberId` / `member_id`
- `role`: `LEADER`, `ASSISTANT_LEADER`, or `MEMBER`
- Composite key: `[ministryId, memberId]`.

Rules:

- There is no separate `MinistryLeader` entity as source of truth.
- Leadership is resolved through `MinistryMember.role`.
- A `User` with `role = BASIC` gains contextual permissions when its linked `memberId` has `LEADER` or `ASSISTANT_LEADER` in the ministry.

### 8. MinistryPosition (`tb_ministry_position`)

Defines service positions available inside a ministry.

- `id`
- `ministryId` / `ministry_id`
- `name`
- `description`
- `colorHex` / `color_hex`
- `order` / `display_order`
- Unique per ministry: `[ministryId, name]`.

### 9. MinistryMemberPosition (`tb_ministry_member_position`)

Defines which positions a member can serve in a ministry.

- `ministryId` / `ministry_id`
- `memberId` / `member_id`
- `positionId` / `position_id`

### 10. Schedule (`tb_schedule`)

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

### 11. ScheduleDay (`tb_schedule_day`)

Individual day inside a schedule.

- `id`
- `scheduleId` / `schedule_id`
- `scheduledDate` / `scheduled_date`
- `title`
- `eventId` / `event_id`
- `notes`
- `order` / `display_order`

### 12. ScheduleDayPositionHidden (`tb_schedule_day_position_hidden`)

Defines positions hidden for a specific schedule day.

- `dayId` / `day_id`
- `positionId` / `position_id`
- Composite key: `[dayId, positionId]`.

### 13. ScheduleAssignment (`tb_schedule_assignment`)

Individual member assignment in a schedule day and ministry position.

- `id`
- `scheduleDayId` / `schedule_day_id`
- `memberId` / `member_id`
- `userId` / `user_id`
- `ministryPositionId` / `ministry_position_id`
- `confirmationStatus` / `confirmation_status`
- `notes`

### 14. Event (`tb_event`)

Calendar event.

- `id`
- `tenantId` / `tenant_id`
- `title`
- `description`
- `startAt` / `start_at`
- `endAt` / `end_at`
- `location`
- `status` / `event_status`
- `createdAt` / `created_at`
- `updatedAt` / `updated_at`

Pending decision: whether `Event` should receive an optional `ministryId` for ministry-specific calendars.

### 15. AuditLog (`tb_audit_log`)

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

### 16. Lead (`tb_lead`)

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
