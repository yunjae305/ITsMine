import "server-only";
import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { getCurrentUser, getGuestTokenHash, type CurrentUser } from "./auth";
import { getDb, schema } from "./db";
import type { GroupMode, GroupStatus, ReceiptItem } from "./db/schema";
import { computeBalances, minimizeTransfers, receiptTotal, type MemberBalance, type Transfer } from "./settlement";

export type Viewer = {
  user: CurrentUser | null;
  member: typeof schema.members.$inferSelect | null;
};

export type BoardMember = {
  id: string;
  nickname: string;
  isOwner: boolean;
  isGuest: boolean;
};

export type BoardReceipt = {
  id: string;
  storeName: string;
  paidByMemberId: string;
  createdByMemberId: string;
  items: ReceiptItem[];
  total: number;
  createdAt: string;
};

export type GroupBoard = {
  id: string;
  name: string;
  mode: GroupMode;
  status: GroupStatus;
  expectedMemberCount: number;
  createdAt: string;
  completedAt: string | null;
  members: BoardMember[];
  receipts: BoardReceipt[];
  balances: MemberBalance[];
  transfers: Transfer[];
  viewerMemberId: string;
  viewerIsOwner: boolean;
  /** 함께 정리 모드에서 아직 인원이 다 차지 않았으면 true */
  waiting: boolean;
  openInviteTokens: string[];
};

export async function getViewer(groupId: string): Promise<Viewer> {
  const [user, guestHash] = await Promise.all([getCurrentUser(), getGuestTokenHash(groupId)]);
  const conditions = [];
  if (user) conditions.push(eq(schema.members.userId, user.id));
  if (guestHash) conditions.push(eq(schema.members.accessTokenHash, guestHash));
  if (!conditions.length) return { user, member: null };
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.members)
    .where(and(eq(schema.members.groupId, groupId), or(...conditions)))
    .orderBy(desc(schema.members.isOwner));
  return { user, member: rows[0] ?? null };
}

export async function loadGroupBoard(groupId: string, viewer: Viewer): Promise<GroupBoard | null> {
  if (!viewer.member) return null;
  const db = await getDb();
  const [group] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId));
  if (!group) return null;
  const [memberRows, receiptRows] = await Promise.all([
    db.select().from(schema.members).where(eq(schema.members.groupId, groupId)).orderBy(asc(schema.members.position)),
    db.select().from(schema.receipts).where(eq(schema.receipts.groupId, groupId)).orderBy(asc(schema.receipts.createdAt)),
  ]);
  const viewerIsOwner = viewer.member.isOwner;
  const openInviteTokens =
    viewerIsOwner && group.mode === "TOGETHER"
      ? (
          await db
            .select({ token: schema.invites.token })
            .from(schema.invites)
            .where(
              and(eq(schema.invites.groupId, groupId), isNull(schema.invites.usedAt), isNull(schema.invites.memberId)),
            )
            .orderBy(asc(schema.invites.createdAt))
        ).map((r) => r.token)
      : [];

  const receipts: BoardReceipt[] = receiptRows.map((r) => ({
    id: r.id,
    storeName: r.storeName,
    paidByMemberId: r.paidByMemberId,
    createdByMemberId: r.createdByMemberId,
    items: r.items,
    total: receiptTotal(r),
    createdAt: r.createdAt.toISOString(),
  }));
  const balances = computeBalances(
    memberRows.map((m) => m.id),
    receipts.map((r) => ({ paidByMemberId: r.paidByMemberId, items: r.items })),
  );
  return {
    id: group.id,
    name: group.name,
    mode: group.mode,
    status: group.status,
    expectedMemberCount: group.expectedMemberCount,
    createdAt: group.createdAt.toISOString(),
    completedAt: group.completedAt?.toISOString() ?? null,
    members: memberRows.map((m) => ({
      id: m.id,
      nickname: m.nickname,
      isOwner: m.isOwner,
      isGuest: !m.isOwner && m.accessTokenHash !== null,
    })),
    receipts,
    balances,
    transfers: minimizeTransfers(balances),
    viewerMemberId: viewer.member.id,
    viewerIsOwner,
    waiting: group.mode === "TOGETHER" && group.status === "ACTIVE" && memberRows.length < group.expectedMemberCount,
    openInviteTokens,
  };
}

export type DashboardGroup = {
  id: string;
  name: string;
  mode: GroupMode;
  status: GroupStatus;
  waiting: boolean;
  isOwner: boolean;
  memberCount: number;
  receiptCount: number;
  myBalance: number;
  createdAt: string;
};

export type MoneyFlowEntry = { groupId: string; groupName: string; counterpart: string; amount: number };

export type Dashboard = {
  groups: DashboardGroup[];
  receive: MoneyFlowEntry[];
  send: MoneyFlowEntry[];
};

export async function loadDashboard(userId: string): Promise<Dashboard> {
  const db = await getDb();
  const mine = await db
    .select({ member: schema.members, group: schema.groups })
    .from(schema.members)
    .innerJoin(schema.groups, eq(schema.groups.id, schema.members.groupId))
    .where(eq(schema.members.userId, userId))
    .orderBy(desc(schema.groups.createdAt));
  if (!mine.length) return { groups: [], receive: [], send: [] };

  const groupIds = [...new Set(mine.map((m) => m.group.id))];
  const [allMembers, allReceipts] = await Promise.all([
    db.select().from(schema.members).where(inArray(schema.members.groupId, groupIds)).orderBy(asc(schema.members.position)),
    db.select().from(schema.receipts).where(inArray(schema.receipts.groupId, groupIds)),
  ]);

  const groups: DashboardGroup[] = [];
  const receive: MoneyFlowEntry[] = [];
  const send: MoneyFlowEntry[] = [];
  const seen = new Set<string>();
  for (const { member, group } of mine) {
    if (seen.has(group.id)) continue;
    seen.add(group.id);
    const members = allMembers.filter((m) => m.groupId === group.id);
    const receipts = allReceipts.filter((r) => r.groupId === group.id);
    const balances = computeBalances(
      members.map((m) => m.id),
      receipts.map((r) => ({ paidByMemberId: r.paidByMemberId, items: r.items })),
    );
    const myBalance = balances.find((b) => b.memberId === member.id)?.balance ?? 0;
    groups.push({
      id: group.id,
      name: group.name,
      mode: group.mode,
      status: group.status,
      waiting: group.mode === "TOGETHER" && group.status === "ACTIVE" && members.length < group.expectedMemberCount,
      isOwner: member.isOwner,
      memberCount: group.mode === "TOGETHER" ? group.expectedMemberCount : members.length,
      receiptCount: receipts.length,
      myBalance,
      createdAt: group.createdAt.toISOString(),
    });
    if (group.status !== "ACTIVE") continue;
    const nickname = new Map(members.map((m) => [m.id, m.nickname]));
    for (const t of minimizeTransfers(balances)) {
      if (t.toMemberId === member.id) {
        receive.push({ groupId: group.id, groupName: group.name, counterpart: nickname.get(t.fromMemberId) ?? "참여자", amount: t.amount });
      } else if (t.fromMemberId === member.id) {
        send.push({ groupId: group.id, groupName: group.name, counterpart: nickname.get(t.toMemberId) ?? "참여자", amount: t.amount });
      }
    }
  }
  return { groups, receive, send };
}

export type NotificationView = { id: string; title: string; body: string; groupId: string | null; read: boolean; createdAt: string };

export async function loadNotifications(userId: string): Promise<NotificationView[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, userId))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(30);
  return rows.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    groupId: n.groupId,
    read: n.readAt !== null,
    createdAt: n.createdAt.toISOString(),
  }));
}

export async function loadArchives(userId: string, groupId?: string) {
  const db = await getDb();
  const rows = await db
    .select({
      id: schema.archives.id,
      groupId: schema.archives.groupId,
      title: schema.archives.title,
      createdAt: schema.archives.createdAt,
    })
    .from(schema.archives)
    .where(groupId ? and(eq(schema.archives.userId, userId), eq(schema.archives.groupId, groupId)) : eq(schema.archives.userId, userId))
    .orderBy(desc(schema.archives.createdAt));
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export type ArchiveView = Awaited<ReturnType<typeof loadArchives>>[number];
