import { Router } from "express";
import { db, productsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

function toProductResponse(p: typeof productsTable.$inferSelect) {
  return {
    id: p.id,
    name: p.name,
    salePrice: parseFloat(p.salePrice),
    purchasePrice: parseFloat(p.purchasePrice),
    stock: p.stock,
    lowStockThreshold: p.lowStockThreshold,
    category: p.category,
    barcode: p.barcode,
    photoUrl: p.photoUrl,
    createdAt: p.createdAt,
  };
}

router.get("/stock/alerts", requireAuth, async (_req, res): Promise<void> => {
  const lowStock = await db
    .select()
    .from(productsTable)
    .where(sql`${productsTable.stock} <= ${productsTable.lowStockThreshold} AND ${productsTable.stock} > 0`);

  const outOfStock = await db
    .select()
    .from(productsTable)
    .where(sql`${productsTable.stock} = 0`);

  res.json({
    lowStock: lowStock.map(toProductResponse),
    outOfStock: outOfStock.map(toProductResponse),
  });
});

export default router;
