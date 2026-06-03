import { Router } from "express";
import { db, debtsTable, debtPaymentsTable, customersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import {
  ListDebtsQueryParams,
  CreateDebtBody,
  GetDebtParams,
  UpdateDebtParams,
  UpdateDebtBody,
  AddDebtPaymentParams,
  AddDebtPaymentBody,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router = Router();

async function getDebtWithDetails(debtId: number) {
  const [debt] = await db.select().from(debtsTable).where(eq(debtsTable.id, debtId)).limit(1);
  if (!debt) return null;

  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, debt.customerId)).limit(1);
  const payments = await db.select().from(debtPaymentsTable).where(eq(debtPaymentsTable.debtId, debtId)).orderBy(debtPaymentsTable.paidAt);

  return {
    id: debt.id,
    customerId: debt.customerId,
    customerName: customer?.name ?? "Inconnu",
    customerPhone: customer?.phone ?? "",
    saleId: debt.saleId,
    originalAmount: parseFloat(debt.originalAmount),
    remainingAmount: parseFloat(debt.remainingAmount),
    status: debt.status,
    dueDate: debt.dueDate,
    note: debt.note,
    payments: payments.map((p) => ({
      id: p.id,
      debtId: p.debtId,
      amount: parseFloat(p.amount),
      note: p.note,
      paidAt: p.paidAt,
    })),
    createdAt: debt.createdAt,
  };
}

router.get("/debts", requireAuth, async (req, res): Promise<void> => {
  const params = ListDebtsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conditions = [];
  if (params.data.customerId) conditions.push(eq(debtsTable.customerId, params.data.customerId));
  if (params.data.status) conditions.push(eq(debtsTable.status, params.data.status as "pending" | "partial" | "paid"));

  const debts = await db
    .select()
    .from(debtsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(debtsTable.createdAt);

  const result = await Promise.all(debts.map((d) => getDebtWithDetails(d.id)));
  res.json(result.filter(Boolean));
});

router.post("/debts", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateDebtBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = parsed.data;

  const [debt] = await db.insert(debtsTable).values({
    customerId: data.customerId,
    saleId: data.saleId ?? null,
    originalAmount: String(data.originalAmount),
    remainingAmount: String(data.originalAmount),
    status: "pending",
    dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
    note: data.note ?? null,
  }).returning();

  const result = await getDebtWithDetails(debt.id);
  res.status(201).json(result);
});

router.get("/debts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetDebtParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const debt = await getDebtWithDetails(params.data.id);
  if (!debt) {
    res.status(404).json({ error: "Dette introuvable" });
    return;
  }
  res.json(debt);
});

router.patch("/debts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateDebtParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateDebtBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (body.data.dueDate !== undefined) updateData.dueDate = body.data.dueDate;
  if (body.data.note !== undefined) updateData.note = body.data.note;
  if (body.data.status !== undefined) updateData.status = body.data.status;

  const [updated] = await db
    .update(debtsTable)
    .set(updateData)
    .where(eq(debtsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Dette introuvable" });
    return;
  }
  const result = await getDebtWithDetails(updated.id);
  res.json(result);
});

router.post("/debts/:id/payments", requireAuth, async (req, res): Promise<void> => {
  const params = AddDebtPaymentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = AddDebtPaymentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [debt] = await db.select().from(debtsTable).where(eq(debtsTable.id, params.data.id)).limit(1);
  if (!debt) {
    res.status(404).json({ error: "Dette introuvable" });
    return;
  }

  const [payment] = await db.insert(debtPaymentsTable).values({
    debtId: params.data.id,
    amount: String(body.data.amount),
    note: body.data.note ?? null,
  }).returning();

  const newRemaining = Math.max(0, parseFloat(debt.remainingAmount) - body.data.amount);
  const newStatus: "pending" | "partial" | "paid" = newRemaining === 0 ? "paid" : newRemaining < parseFloat(debt.originalAmount) ? "partial" : "pending";

  await db.update(debtsTable).set({
    remainingAmount: String(newRemaining),
    status: newStatus,
  }).where(eq(debtsTable.id, params.data.id));

  res.status(201).json({
    id: payment.id,
    debtId: payment.debtId,
    amount: parseFloat(payment.amount),
    note: payment.note,
    paidAt: payment.paidAt,
  });
});

export default router;
