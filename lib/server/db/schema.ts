import { sql } from 'drizzle-orm';
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  primaryKey
} from 'drizzle-orm/sqlite-core';

// User table — shape required by better-auth, plus our extensions (username, role).
export const users = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  // Extensions
  username: text('username').notNull().unique(),
  role: text('role').notNull() // 'owner' | 'member'
});

// Session — better-auth schema.
export const sessions = sqliteTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

// Account — holds credentials (providerId='credential', password) and OAuth tokens.
export const accounts = sqliteTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  providerId: text('provider_id').notNull(),
  accountId: text('account_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

// Verification — short-lived tokens (email verification, password reset).
export const verifications = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export const families = sqliteTable('families', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ownerUserId: text('owner_user_id')
    .notNull()
    .references(() => users.id),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
});

export const familyMembers = sqliteTable(
  'family_members',
  {
    id: text('id').primaryKey(),
    familyId: text('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // 'owner' | 'member'
    joinedAt: integer('joined_at').notNull()
  },
  (t) => ({
    uniqFamilyUser: uniqueIndex('uq_family_member_family_user').on(t.familyId, t.userId),
    byUser: index('ix_family_members_user').on(t.userId)
  })
);

export const babies = sqliteTable(
  'babies',
  {
    id: text('id').primaryKey(),
    familyId: text('family_id')
      .notNull()
      .references(() => families.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    birthday: text('birthday').notNull(), // YYYY-MM-DD or "YYYY-MM-DD HH:mm"
    gender: text('gender').notNull(), // 'boy' | 'girl' | 'other'
    avatarUrl: text('avatar_url'),
    status: text('status').notNull(), // 'active' | 'trashed' | 'purged'
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
    deletedBy: text('deleted_by').references(() => users.id)
  },
  (t) => ({
    byFamilyStatus: index('ix_babies_family_status').on(t.familyId, t.status)
  })
);

export const babyMemberPermissions = sqliteTable(
  'baby_member_permissions',
  {
    id: text('id').primaryKey(),
    babyId: text('baby_id')
      .notNull()
      .references(() => babies.id, { onDelete: 'cascade' }),
    familyMemberId: text('family_member_id')
      .notNull()
      .references(() => familyMembers.id, { onDelete: 'cascade' }),
    canRead: integer('can_read').notNull().default(1),
    canWrite: integer('can_write').notNull().default(0),
    canDelete: integer('can_delete').notNull().default(0)
  },
  (t) => ({
    uniqBabyMember: uniqueIndex('uq_baby_member_perm').on(t.babyId, t.familyMemberId),
    byMember: index('ix_baby_member_perm_member').on(t.familyMemberId)
  })
);

export const entries = sqliteTable(
  'entries',
  {
    id: text('id').primaryKey(),
    babyId: text('baby_id')
      .notNull()
      .references(() => babies.id, { onDelete: 'cascade' }),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id),
    content: text('content').notNull(),
    occurredAt: integer('occurred_at').notNull(),
    status: text('status').notNull(), // 'active' | 'trashed' | 'purged'
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
    deletedBy: text('deleted_by').references(() => users.id)
  },
  (t) => ({
    byBabyStatusOccurred: index('ix_entries_baby_status_occurred').on(
      t.babyId,
      t.status,
      t.occurredAt
    ),
    byStatusDeleted: index('ix_entries_status_deleted').on(t.status, t.deletedAt)
  })
);

export const milestones = sqliteTable('milestones', {
  id: text('id').primaryKey(),
  familyId: text('family_id').references(() => families.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  icon: text('icon').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull()
});

export const entryMilestones = sqliteTable(
  'entry_milestones',
  {
    entryId: text('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    milestoneId: text('milestone_id')
      .notNull()
      .references(() => milestones.id, { onDelete: 'cascade' })
  },
  (t) => ({
    pk: primaryKey({ columns: [t.entryId, t.milestoneId] })
  })
);

export const media = sqliteTable(
  'media',
  {
    id: text('id').primaryKey(),
    babyId: text('baby_id')
      .notNull()
      .references(() => babies.id, { onDelete: 'cascade' }),
    uploadedBy: text('uploaded_by')
      .notNull()
      .references(() => users.id),
    clientUploadId: text('client_upload_id').notNull(),
    type: text('type'),
    mimeType: text('mime_type'),
    sizeBytes: integer('size_bytes'),
    contentHash: text('content_hash'),
    width: integer('width'),
    height: integer('height'),
    durationSec: integer('duration_sec'),
    relativePath: text('relative_path'),
    originalExt: text('original_ext'),
    filename: text('filename').notNull(),
    takenAt: integer('taken_at'),
    status: text('status').notNull(),
    // Provenance for orphan cleanup. 'standalone' (default) = a permanent
    // gallery photo (bulk-uploaded history, OR a composer upload that has been
    // saved to an entry — see the attach route, which promotes it); never
    // auto-trashed. 'entry_draft' = a composer upload not yet saved to any
    // entry; if it stays unattached past the cutoff the reconcile worker
    // trashes it. The marker is promoted on attach, so a later detach (which
    // keeps the photo in the gallery) can't make it look like an orphan again.
    origin: text('origin').notNull().default('standalone'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
    deletedBy: text('deleted_by').references(() => users.id)
  },
  (t) => ({
    byBabyStatus: index('ix_media_baby_status').on(t.babyId, t.status),
    byClientUpload: index('ix_media_client_upload').on(t.clientUploadId, t.uploadedBy),
    uniqReadyHash: uniqueIndex('uq_media_baby_hash_ready')
      .on(t.babyId, t.contentHash)
      .where(sql`status = 'ready'`),
    byStatusDeleted: index('ix_media_status_deleted').on(t.status, t.deletedAt)
  })
);

export const entryMedia = sqliteTable(
  'entry_media',
  {
    entryId: text('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    mediaId: text('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    attachedBy: text('attached_by')
      .notNull()
      .references(() => users.id),
    attachedAt: integer('attached_at').notNull()
  },
  (t) => ({
    pk: primaryKey({ columns: [t.entryId, t.mediaId] }),
    byMedia: index('ix_entry_media_media').on(t.mediaId)
  })
);
