export type SettlementItem = {
  quantity: number;
  unit_price: number;
  consumer_member_ids: string[];
};

export type SettlementReceipt = {
  paidByMemberId: string;
  items: SettlementItem[];
};

export type MemberBalance = {
  memberId: string;
  paid: number;
  owes: number;
  /** paid - owes. 양수면 받을 돈, 음수면 보낼 돈. */
  balance: number;
};

export type Transfer = { fromMemberId: string; toMemberId: string; amount: number };

export function itemTotal(item: Pick<SettlementItem, "quantity" | "unit_price">): number {
  return item.quantity * item.unit_price;
}

export function receiptTotal(receipt: { items: Pick<SettlementItem, "quantity" | "unit_price">[] }): number {
  return receipt.items.reduce((sum, item) => sum + itemTotal(item), 0);
}

/**
 * 메뉴 금액을 먹은 사람 수로 나눈다. 나누어떨어지지 않는 원 단위는
 * 먹은 사람 목록의 앞사람부터 1원씩 더 부담한다.
 */
export function splitAmount(amount: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(amount / count);
  const remainder = amount - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

export function computeBalances(memberIds: string[], receipts: SettlementReceipt[]): MemberBalance[] {
  const paid = new Map(memberIds.map((id) => [id, 0]));
  const owes = new Map(memberIds.map((id) => [id, 0]));
  for (const receipt of receipts) {
    for (const item of receipt.items) {
      const total = itemTotal(item);
      paid.set(receipt.paidByMemberId, (paid.get(receipt.paidByMemberId) ?? 0) + total);
      const consumers = item.consumer_member_ids;
      splitAmount(total, consumers.length).forEach((share, i) => {
        owes.set(consumers[i], (owes.get(consumers[i]) ?? 0) + share);
      });
    }
  }
  return memberIds.map((memberId) => {
    const p = paid.get(memberId) ?? 0;
    const o = owes.get(memberId) ?? 0;
    return { memberId, paid: p, owes: o, balance: p - o };
  });
}

/** 가장 많이 보내야 하는 사람과 가장 많이 받아야 하는 사람을 차례로 맞춰 송금 횟수를 줄인다. */
export function minimizeTransfers(balances: Pick<MemberBalance, "memberId" | "balance">[]): Transfer[] {
  const debtors = balances
    .filter((b) => b.balance < 0)
    .map((b) => ({ id: b.memberId, amount: -b.balance }))
    .sort((a, b) => b.amount - a.amount);
  const creditors = balances
    .filter((b) => b.balance > 0)
    .map((b) => ({ id: b.memberId, amount: b.balance }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: Transfer[] = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const amount = Math.min(debtors[d].amount, creditors[c].amount);
    if (amount > 0) transfers.push({ fromMemberId: debtors[d].id, toMemberId: creditors[c].id, amount });
    debtors[d].amount -= amount;
    creditors[c].amount -= amount;
    if (debtors[d].amount === 0) d++;
    if (creditors[c].amount === 0) c++;
  }
  return transfers;
}

export function formatWon(amount: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
}
