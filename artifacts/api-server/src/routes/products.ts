import { Router } from "express";
import { db, productsTable } from "@workspace/db";
import { eq, ilike, and, lte, sql } from "drizzle-orm";
import {
  ListProductsQueryParams,
  CreateProductBody,
  GetProductParams,
  UpdateProductParams,
  UpdateProductBody,
  DeleteProductParams,
} from "@workspace/api-zod";
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

router.get("/products", requireAuth, async (req, res): Promise<void> => {
  const params = ListProductsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { search, category, lowStock } = params.data;
  const conditions = [];

  if (search) conditions.push(ilike(productsTable.name, `%${search}%`));
  if (category) conditions.push(eq(productsTable.category, category));
  if (lowStock === true) {
    conditions.push(lte(productsTable.stock, productsTable.lowStockThreshold));
  }

  const products = await db
    .select()
    .from(productsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(productsTable.name);

  res.json(products.map(toProductResponse));
});

router.post("/products", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = parsed.data;
  const [product] = await db.insert(productsTable).values({
    name: data.name,
    salePrice: String(data.salePrice),
    purchasePrice: String(data.purchasePrice),
    stock: data.stock,
    lowStockThreshold: data.lowStockThreshold ?? 5,
    category: data.category,
    barcode: data.barcode ?? null,
    photoUrl: data.photoUrl ?? null,
  }).returning();

  res.status(201).json(toProductResponse(product));
});

router.get("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id)).limit(1);
  if (!product) {
    res.status(404).json({ error: "Produit introuvable" });
    return;
  }
  res.json(toProductResponse(product));
});

router.patch("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateProductBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (body.data.name !== undefined) updateData.name = body.data.name;
  if (body.data.salePrice !== undefined) updateData.salePrice = String(body.data.salePrice);
  if (body.data.purchasePrice !== undefined) updateData.purchasePrice = String(body.data.purchasePrice);
  if (body.data.stock !== undefined) updateData.stock = body.data.stock;
  if (body.data.lowStockThreshold !== undefined) updateData.lowStockThreshold = body.data.lowStockThreshold;
  if (body.data.category !== undefined) updateData.category = body.data.category;
  if (body.data.barcode !== undefined) updateData.barcode = body.data.barcode;
  if (body.data.photoUrl !== undefined) updateData.photoUrl = body.data.photoUrl;

  const [product] = await db
    .update(productsTable)
    .set(updateData)
    .where(eq(productsTable.id, params.data.id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Produit introuvable" });
    return;
  }
  res.json(toProductResponse(product));
});

router.delete("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db.delete(productsTable).where(eq(productsTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Produit introuvable" });
    return;
  }
  res.sendStatus(204);
});

export default router;
