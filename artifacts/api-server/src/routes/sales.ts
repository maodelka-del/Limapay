import { Router } from "express";
import { db, salesTable, saleItemsTable, productsTable, customersTable, inventoryMovementsTable } from "@workspace/db";
import { eq, desc, gte, lte, and, sql } from "drizzle-orm";
import {
  ListSalesQueryParams,
  CreateSaleBody,
  GetSaleParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router = Router();

async function getSaleWithItems(saleId: number) {
  const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, saleId)).limit(1);
  if (!sale) return null;

  const items = await db.select().from(saleItemsTable).where(eq(saleItemsTable.saleId, saleId));

  let customerName: string | null = null;
  if (sale.customerId) {
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, sale.customerId)).limit(1);
    customerName = customer?.name ?? null;
  }

  return {
    id: sale.id,
    totalAmount: parseFloat(sale.totalAmount),
    amountPaid: parseFloat(sale.amountPaid),
    changeAmount: parseFloat(sale.changeAmount),
    paymentMethod: sale.paymentMethod,
    status: sale.status,
    customerId: sale.customerId,
    customerName,
    diamondPayTransactionId: sale.diamondPayTransactionId,
    items: items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: parseFloat(item.unitPrice),
      totalPrice: parseFloat(item.totalPrice),
    })),
    createdAt: sale.createdAt,
  };
}

router.get("/sales", requireAuth, async (req, res): Promise<void> => {
  const params = ListSalesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conditions = [];
  if (params.data.dateFrom) conditions.push(gte(salesTable.createdAt, new Date(params.data.dateFrom)));
  if (params.data.dateTo) {
    const to = new Date(params.data.dateTo);
    to.setHours(23, 59, 59, 999);
    conditions.push(lte(salesTable.createdAt, to));
  }

  const limit = params.data.limit ?? 50;
  const sales = await db
    .select()
    .from(salesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(salesTable.createdAt))
    .limit(limit);

  const result = await Promise.all(sales.map((s) => getSaleWithItems(s.id)));
  res.json(result.filter(Boolean));
});

router.post("/sales", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateSaleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = parsed.data;

  // Fetch products to get names and prices
  const productIds = data.items.map((i) => i.productId);
  const products = await db.select().from(productsTable).where(
    sql`${productsTable.id} = ANY(${sql.raw(`ARRAY[${productIds.join(",")}]::int[]`)})`
  );

  const productMap = new Map(products.map((p) => [p.id, p]));

  // Calculate total and build items
  let calculatedTotal = 0;
  const saleItemsData = data.items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) throw new Error(`Produit ${item.productId} introuvable`);
    const unitPrice = parseFloat(product.salePrice);
    const totalPrice = unitPrice * item.quantity;
    calculatedTotal += totalPrice;
    return {
      productId: item.productId,
      productName: product.name,
      quantity: item.quantity,
      unitPrice: String(unitPrice),
      totalPrice: String(totalPrice),
    };
  });

  const totalAmount = data.totalAmount ?? calculatedTotal;
  const amountPaid = data.amountPaid ?? totalAmount;
  const changeAmount = Math.max(0, amountPaid - totalAmount);

  // Create the sale
  const [sale] = await db.insert(salesTable).values({
    totalAmount: String(totalAmount),
    amountPaid: String(amountPaid),
    changeAmount: String(changeAmount),
    paymentMethod: data.paymentMethod,
    status: "completed",
    customerId: data.customerId ?? null,
    diamondPayTransactionId: data.diamondPayTransactionId ?? null,
    mobilePayRef: (data as any).mobilePayRef ?? null,
  }).returning();

  // Insert sale items
  const insertedItems = await db.insert(saleItemsTable).values(
    saleItemsData.map((item) => ({ ...item, saleId: sale.id }))
  ).returning();

  // Deduct stock and record inventory movements
  await Promise.all(
    data.items.map(async (item) => {
      const product = productMap.get(item.productId)!;
      const newStock = Math.max(0, product.stock - item.quantity);

      await db.update(productsTable).set({ stock: newStock }).where(eq(productsTable.id, item.productId));

      await db.insert(inventoryMovementsTable).values({
        productId: item.productId,
        type: "sale",
        quantityChange: -item.quantity,
        quantityAfter: newStock,
        referenceId: sale.id,
        note: `Vente #${sale.id}`,
      });
    })
  );

  const result = await getSaleWithItems(sale.id);
  res.status(201).json(result);
});

router.get("/sales/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetSaleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const sale = await getSaleWithItems(params.data.id);
  if (!sale) {
    res.status(404).json({ error: "Vente introuvable" });
    return;
  }
  res.json(sale);
});

export default router;
