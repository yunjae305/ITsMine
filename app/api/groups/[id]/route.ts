import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { getViewer } from "@/lib/groups";
import { fail, ok, readJson } from "@/lib/http";
import { randomToken } from "@/lib/tokens";

const ReceiptInput = z.object({
  id: z.uuid().optional(),
  store_name: z.string().trim().min(1).max(40),
  paid_by_member_id: z.uuid(),
  items: z
    .array(
      z.object({
        menu_name: z.string().trim().min(1).max(40),
        quantity: z.number().int().min(1).max(999),
        unit_price: z.number().int().min(0).max(100_000_000),
        consumer_member_ids: z.array(z.uuid()).min(1, "메뉴 참여자가 필요합니다."),
      }),
    )
    .min(1)
    .max(100),
});

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("saveReceipt"), receipt: ReceiptInput }),
  z.object({ action: z.literal("deleteReceipt"), receiptId: z.uuid() }),
  z.object({ action: z.literal("completeSettlement") }),
  z.object({ action: z.literal("rename"), name: z.string().trim().min(1).max(40) }),
  z.object({ action: z.literal("deleteGroup") }),
  z.object({ action: z.literal("createReconnectInvite"), memberId: z.uuid() }),
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params;
  const parsed = Action.safeParse(await readJson(request));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "요청을 확인해 주세요.");
  const viewer = await getViewer(groupId);
  const me = viewer.member;
  if (!me) return fail("이 모임에 참여한 사람만 할 수 있어요.", 403);

  const db = await getDb();
  const [group] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId));
  if (!group) return fail("모임을 찾을 수 없어요.", 404);
  const body = parsed.data;
  const ownerOnly = () => (me.isOwner ? null : fail("총대만 할 수 있어요.", 403));
  const activeOnly = () => (group.status === "ACTIVE" ? null : fail("완료된 정산은 수정할 수 없어요.", 409));

  switch (body.action) {
    case "saveReceipt": {
      const blocked = activeOnly();
      if (blocked) return blocked;
      const members = await db.select({ id: schema.members.id }).from(schema.members).where(eq(schema.members.groupId, groupId));
      const memberIds = new Set(members.map((m) => m.id));
      if (group.mode === "TOGETHER" && members.length < group.expectedMemberCount) {
        return fail("모두 참여한 뒤에 영수증을 올릴 수 있어요.", 409);
      }
      const { receipt } = body;
      // 혼자 정리에서는 총대가 결제자를 고를 수 있고, 함께 정리에서는 본인이 결제한 영수증만 올린다.
      const paidBy = group.mode === "SOLO" && me.isOwner ? receipt.paid_by_member_id : me.id;
      const everyone = [paidBy, ...receipt.items.flatMap((i) => i.consumer_member_ids)];
      if (!everyone.every((id) => memberIds.has(id))) return fail("알 수 없는 참여자가 있어요.");
      const items = receipt.items.map((i) => ({ ...i, consumer_member_ids: [...new Set(i.consumer_member_ids)] }));
      if (receipt.id) {
        const [existing] = await db
          .select()
          .from(schema.receipts)
          .where(and(eq(schema.receipts.id, receipt.id), eq(schema.receipts.groupId, groupId)));
        if (!existing) return fail("영수증을 찾을 수 없어요.", 404);
        if (existing.createdByMemberId !== me.id && !me.isOwner) return fail("직접 올린 영수증만 수정할 수 있어요.", 403);
        await db
          .update(schema.receipts)
          .set({ storeName: receipt.store_name, paidByMemberId: paidBy, items })
          .where(eq(schema.receipts.id, receipt.id));
        return ok({ receiptId: receipt.id });
      }
      const [created] = await db
        .insert(schema.receipts)
        .values({ groupId, storeName: receipt.store_name, paidByMemberId: paidBy, createdByMemberId: me.id, items })
        .returning({ id: schema.receipts.id });
      return ok({ receiptId: created.id });
    }
    case "deleteReceipt": {
      const blocked = activeOnly();
      if (blocked) return blocked;
      const [existing] = await db
        .select()
        .from(schema.receipts)
        .where(and(eq(schema.receipts.id, body.receiptId), eq(schema.receipts.groupId, groupId)));
      if (!existing) return fail("영수증을 찾을 수 없어요.", 404);
      if (existing.createdByMemberId !== me.id && !me.isOwner) return fail("직접 올린 영수증만 삭제할 수 있어요.", 403);
      await db.delete(schema.receipts).where(eq(schema.receipts.id, body.receiptId));
      return ok({ ok: true });
    }
    case "completeSettlement": {
      const blocked = ownerOnly() ?? activeOnly();
      if (blocked) return blocked;
      const [{ value: receiptCount }] = await db
        .select({ value: count() })
        .from(schema.receipts)
        .where(eq(schema.receipts.groupId, groupId));
      if (!receiptCount) return fail("영수증을 한 장 이상 등록해 주세요.", 409);
      await db
        .update(schema.groups)
        .set({ status: "COMPLETED", completedAt: new Date() })
        .where(eq(schema.groups.id, groupId));
      const others = await db
        .select({ userId: schema.members.userId })
        .from(schema.members)
        .where(and(eq(schema.members.groupId, groupId), eq(schema.members.isOwner, false)));
      const userIds = [...new Set(others.map((o) => o.userId).filter((v): v is string => !!v))];
      if (userIds.length) {
        await db.insert(schema.notifications).values(
          userIds.map((userId) => ({
            userId,
            groupId,
            title: "총대가 정산을 완료했어요",
            body: `${group.name} · 정산표를 확인해 보세요`,
          })),
        );
      }
      return ok({ ok: true });
    }
    case "rename": {
      const blocked = ownerOnly();
      if (blocked) return blocked;
      await db.update(schema.groups).set({ name: body.name }).where(eq(schema.groups.id, groupId));
      return ok({ ok: true });
    }
    case "deleteGroup": {
      const blocked = ownerOnly();
      if (blocked) return blocked;
      await db.delete(schema.groups).where(eq(schema.groups.id, groupId));
      return ok({ ok: true });
    }
    case "createReconnectInvite": {
      const blocked = ownerOnly();
      if (blocked) return blocked;
      const [target] = await db
        .select()
        .from(schema.members)
        .where(and(eq(schema.members.id, body.memberId), eq(schema.members.groupId, groupId)));
      if (!target || target.isOwner) return fail("참여자를 찾을 수 없어요.", 404);
      const token = randomToken();
      await db.insert(schema.invites).values({ token, groupId, memberId: target.id });
      return ok({ token });
    }
  }
}
