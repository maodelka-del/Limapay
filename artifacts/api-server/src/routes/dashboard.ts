import { Router } from "express";
import { db, salesTable, saleItemsTable, debtsTable, productsTable } from "@workspace/db";
import { gte, lte, and, sql, sum, count, avg, desc } from "drizzle-orm";
import { GetTopProductsQueryParams, GetSalesByPeriodQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router = Router();

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date = new Date()) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

router.get("/dashboard/summary", requireAuth, async (_req, res): Promise<void> => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);

  const [todayStats] = await db
    .select({ revenue: sum(salesTable.totalAmount), salesCount: count(salesTable.id) })
    .from(salesTable)
    .where(gte(salesTable.createdAt, todayStart));

  const [weekStats] = await db
    .select({ revenue: sum(salesTable.totalAmount), salesCount: count(salesTable.id) })
    .from(salesTable)
    .where(gte(salesTable.createdAt, weekStart));

  const [monthStats] = await db
    .select({ revenue: sum(salesTable.totalAmount), salesCount: count(salesTable.id) })
    .from(salesTable)
    .where(gte(salesTable.createdAt, monthStart));

  const [avgBasket] = await db
    .select({ avg: avg(salesTable.totalAmount) })
    .from(salesTable)
    .where(gte(salesTable.createdAt, monthStart));

  const [debtTotal] = await db
    .select({ total: sum(debtsTable.remainingAmount) })
    .from(debtsTable)
    .where(sql`${debtsTable.status} != 'paid'`);

  const [productStats] = await db
    .select({ total: count(productsTable.id) })
    .from(productsTable);

  const lowStockItems = await db
    .select()
    .from(productsTable)
    .where(sql`${productsTable.stock} <= ${productsTable.lowStockThreshold} AND ${productsTable.stock} > 0`);

  const outOfStockItems = await db
    .select()
    .from(productsTable)
    .where(sql`${productsTable.stock} = 0`);

  res.json({
    revenueToday: parseFloat(todayStats?.revenue ?? "0"),
    revenueWeek: parseFloat(weekStats?.revenue ?? "0"),
    revenueMonth: parseFloat(monthStats?.revenue ?? "0"),
    salesToday: todayStats?.salesCount ?? 0,
    salesWeek: weekStats?.salesCount ?? 0,
    salesMonth: monthStats?.salesCount ?? 0,
    averageBasket: parseFloat(avgBasket?.avg ?? "0"),
    totalDebtAmount: parseFloat(debtTotal?.total ?? "0"),
    totalProducts: productStats?.total ?? 0,
    lowStockCount: lowStockItems.length,
    outOfStockCount: outOfStockItems.length,
  });
});

router.get("/dashboard/top-products", requireAuth, async (req, res): Promise<void> => {
  const params = GetTopProductsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const limit = params.data.limit ?? 10;
  const topProducts = await db
    .select({
      productId: saleItemsTable.productId,
      productName: saleItemsTable.productName,
      totalQuantity: sum(saleItemsTable.quantity),
      totalRevenue: sum(saleItemsTable.totalPrice),
    })
    .from(saleItemsTable)
    .groupBy(saleItemsTable.productId, saleItemsTable.productName)
    .orderBy(desc(sum(saleItemsTable.quantity)))
    .limit(limit);

  res.json(topProducts.map((p) => ({
    productId: p.productId,
    productName: p.productName,
    totalQuantity: parseInt(String(p.totalQuantity ?? "0")),
    totalRevenue: parseFloat(String(p.totalRevenue ?? "0")),
  })));
});

router.get("/dashboard/sales-by-period", requireAuth, async (req, res): Promise<void> => {
  const params = GetSalesByPeriodQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const period = params.data.period ?? "week";
  const points: { label: string; revenue: number; salesCount: number }[] = [];

  if (period === "day") {
    // Last 24 hours, hourly
    for (let h = 0; h < 24; h++) {
      const from = new Date();
      from.setHours(h, 0, 0, 0);
      const to = new Date();
      to.setHours(h, 59, 59, 999);
      const [stats] = await db
        .select({ revenue: sum(salesTable.totalAmount), cnt: count(salesTable.id) })
        .from(salesTable)
        .where(and(gte(salesTable.createdAt, from), lte(salesTable.createdAt, to)));
      points.push({ label: `${h}h`, revenue: parseFloat(stats?.revenue ?? "0"), salesCount: stats?.cnt ?? 0 });
    }
  } else if (period === "week") {
    // Last 7 days
    const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const from = new Date(d); from.setHours(0, 0, 0, 0);
      const to = new Date(d); to.setHours(23, 59, 59, 999);
      const [stats] = await db
        .select({ revenue: sum(salesTable.totalAmount), cnt: count(salesTable.id) })
        .from(salesTable)
        .where(and(gte(salesTable.createdAt, from), lte(salesTable.createdAt, to)));
      points.push({ label: days[d.getDay()], revenue: parseFloat(stats?.revenue ?? "0"), salesCount: stats?.cnt ?? 0 });
    }
  } else {
    // Last 30 days
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const from = new Date(d); from.setHours(0, 0, 0, 0);
      const to = new Date(d); to.setHours(23, 59, 59, 999);
      const [stats] = await db
        .select({ revenue: sum(salesTable.totalAmount), cnt: count(salesTable.id) })
        .from(salesTable)
        .where(and(gte(salesTable.createdAt, from), lte(salesTable.createdAt, to)));
      points.push({
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        revenue: parseFloat(stats?.revenue ?? "0"),
        salesCount: stats?.cnt ?? 0,
      });
    }
  }

  res.json(points);
});

export default router;
