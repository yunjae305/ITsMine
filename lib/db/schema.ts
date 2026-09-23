import {
  boolean,
  customType,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (value) => Buffer.from(value),
});

export type GroupMode = "SOLO" | "TOGETHER";
export type GroupStatus = "ACTIVE" | "COMPLETED";

export type ReceiptItem = {
  menu_name: string;
  quantity: number;
  unit_price: number;
  consumer_member_ids: string[];
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  username: text("username").unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  mode: text("mode").$type<GroupMode>().notNull(),
  status: text("status").$type<GroupStatus>().notNull().default("ACTIVE"),
  expectedMemberCount: integer("expected_member_count").notNull(),
  ownerUserId: uuid("owner_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const members = pgTable("members", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull(),
  userId: uuid("user_id"),
  nickname: text("nickname").notNull(),
  isOwner: boolean("is_owner").notNull().default(false),
  accessTokenHash: text("access_token_hash"),
  position: integer("position").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invites = pgTable("invites", {
  token: text("token").primaryKey(),
  groupId: uuid("group_id").notNull(),
  /** 재접속 링크일 때 대상 참여자. 비어 있으면 새 참여자 자리. */
  memberId: uuid("member_id"),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const receipts = pgTable("receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull(),
  storeName: text("store_name").notNull(),
  paidByMemberId: uuid("paid_by_member_id").notNull(),
  createdByMemberId: uuid("created_by_member_id").notNull(),
  items: jsonb("items").$type<ReceiptItem[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  groupId: uuid("group_id"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const archives = pgTable("archives", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  groupId: uuid("group_id").notNull(),
  title: text("title").notNull(),
  image: bytea("image").notNull(),
  mimeType: text("mime_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const BOOTSTRAP_SQL = `
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  username text unique,
  name text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);
create table if not exists sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null
);
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mode text not null,
  status text not null default 'ACTIVE',
  expected_member_count integer not null,
  owner_user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  nickname text not null,
  is_owner boolean not null default false,
  access_token_hash text,
  position integer not null,
  created_at timestamptz not null default now()
);
create index if not exists members_group_idx on members(group_id);
create index if not exists members_user_idx on members(user_id);
create table if not exists invites (
  token text primary key,
  group_id uuid not null references groups(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  store_name text not null,
  paid_by_member_id uuid not null references members(id) on delete cascade,
  created_by_member_id uuid not null references members(id) on delete cascade,
  items jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists receipts_group_idx on receipts(group_id);
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications(user_id, created_at desc);
create table if not exists archives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  title text not null,
  image bytea not null,
  mime_type text not null,
  created_at timestamptz not null default now()
);
create index if not exists archives_user_idx on archives(user_id, created_at desc);
create index if not exists sessions_user_idx on sessions(user_id);
create index if not exists groups_owner_idx on groups(owner_user_id);
create index if not exists invites_group_idx on invites(group_id);
create index if not exists invites_member_idx on invites(member_id);
create index if not exists receipts_paid_by_idx on receipts(paid_by_member_id);
create index if not exists receipts_created_by_idx on receipts(created_by_member_id);
create index if not exists notifications_group_idx on notifications(group_id);
create index if not exists archives_group_idx on archives(group_id);
-- Supabase 는 public 스키마를 REST API 로 공개하므로 RLS 를 켜 두어 anon 키로는 읽을 수 없게 한다.
-- 앱은 서버에서 DB 소유자 계정으로 직접 접속하므로 RLS 의 영향을 받지 않는다.
alter table users enable row level security;
alter table sessions enable row level security;
alter table groups enable row level security;
alter table members enable row level security;
alter table invites enable row level security;
alter table receipts enable row level security;
alter table notifications enable row level security;
alter table archives enable row level security;
`;
