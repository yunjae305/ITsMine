import assert from "node:assert/strict";
import { test } from "node:test";
import { computeBalances, minimizeTransfers, splitAmount } from "./settlement.ts";

test("splitAmount gives the remainder to the first people", () => {
  assert.deepEqual(splitAmount(10000, 3), [3334, 3333, 3333]);
  assert.deepEqual(splitAmount(15000, 3), [5000, 5000, 5000]);
  assert.deepEqual(splitAmount(100, 0), []);
});

test("computes balances per menu consumer (원본 사이트 예시)", () => {
  const balances = computeBalances(
    ["me", "cs", "yh"],
    [
      {
        paidByMemberId: "me",
        items: [
          { quantity: 1, unit_price: 14000, consumer_member_ids: ["me", "cs"] },
          { quantity: 3, unit_price: 5000, consumer_member_ids: ["me", "cs", "yh"] },
        ],
      },
    ],
  );
  assert.deepEqual(balances, [
    { memberId: "me", paid: 29000, owes: 12000, balance: 17000 },
    { memberId: "cs", paid: 0, owes: 12000, balance: -12000 },
    { memberId: "yh", paid: 0, owes: 5000, balance: -5000 },
  ]);
  assert.deepEqual(minimizeTransfers(balances), [
    { fromMemberId: "cs", toMemberId: "me", amount: 12000 },
    { fromMemberId: "yh", toMemberId: "me", amount: 5000 },
  ]);
});

test("minimizeTransfers settles multiple payers", () => {
  const transfers = minimizeTransfers([
    { memberId: "a", balance: 7000 },
    { memberId: "b", balance: 3000 },
    { memberId: "c", balance: -6000 },
    { memberId: "d", balance: -4000 },
  ]);
  assert.deepEqual(transfers, [
    { fromMemberId: "c", toMemberId: "a", amount: 6000 },
    { fromMemberId: "d", toMemberId: "a", amount: 1000 },
    { fromMemberId: "d", toMemberId: "b", amount: 3000 },
  ]);
  const net = new Map<string, number>();
  for (const t of transfers) {
    net.set(t.fromMemberId, (net.get(t.fromMemberId) ?? 0) - t.amount);
    net.set(t.toMemberId, (net.get(t.toMemberId) ?? 0) + t.amount);
  }
  assert.deepEqual(Object.fromEntries(net), { a: 7000, b: 3000, c: -6000, d: -4000 });
});
