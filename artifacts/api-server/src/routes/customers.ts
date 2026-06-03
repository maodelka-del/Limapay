import { Router } from "express";
import { db, customersTable, debtsTable } from "@workspace/db";
import { eq, ilike, sum, sql } from "drizzle-orm";
import {
  ListCustomersQueryParams,
  CreateCustomerBody,
  GetCustomerParams,
  UpdateCustomerParams,
  UpdateCustomerBody,
  DeleteCustomerParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router = Router();

async function getCustomerWithDebt(customerId: number) {
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, customerId)).limit(1);
  if (!customer) return null;

  const [debtResult] = await db
    .select({ totalDebt: sum(debtsTable.remainingAmount) })
    .from(debtsTable)
    .where(eq(debtsTable.customerId, customerId));

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    totalDebt: parseFloat(debtResult?.totalDebt ?? "0"),
    createdAt: customer.createdAt,
  };
}

router.get("/customers", requireAuth, async (req, res): Promise<void> => {
  const params = ListCustomersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  let query = db.select().from(customersTable);
  if (params.data.search) {
    // @ts-ignore
    query = query.where(ilike(customersTable.name, `%${params.data.search}%`));
  }

  const customers = await query.orderBy(customersTable.name);

  const customersWithDebt = await Promise.all(
    customers.map(async (c) => {
      const [debtResult] = await db
        .select({ totalDebt: sum(debtsTable.remainingAmount) })
        .from(debtsTable)
        .where(eq(debtsTable.customerId, c.id));
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        totalDebt: parseFloat(debtResult?.totalDebt ?? "0"),
        createdAt: c.createdAt,
      };
    })
  );

  res.json(customersWithDebt);
});

router.post("/customers", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [customer] = await db.insert(customersTable).values({
    name: parsed.data.name,
    phone: parsed.data.phone,
    email: parsed.data.email ?? null,
  }).returning();

  res.status(201).json({ ...customer, totalDebt: 0 });
});

router.get("/customers/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const customer = await getCustomerWithDebt(params.data.id);
  if (!customer) {
    res.status(404).json({ error: "Client introuvable" });
    return;
  }
  res.json(customer);
});

router.patch("/customers/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateCustomerBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (body.data.name !== undefined) updateData.name = body.data.name;
  if (body.data.phone !== undefined) updateData.phone = body.data.phone;
  if (body.data.email !== undefined) updateData.email = body.data.email;

  const [customer] = await db
    .update(customersTable)
    .set(updateData)
    .where(eq(customersTable.id, params.data.id))
    .returning();

  if (!customer) {
    res.status(404).json({ error: "Client introuvable" });
    return;
  }

  const result = await getCustomerWithDebt(customer.id);
  res.json(result);
});

router.delete("/customers/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db.delete(customersTable).where(eq(customersTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Client introuvable" });
    return;
  }
  res.sendStatus(204);
});

export default router;
