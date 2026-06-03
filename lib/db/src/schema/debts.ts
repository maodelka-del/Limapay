import { pgTable, text, serial, timestamp, integer, numeric, pgEnum, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { salesTable } from "./sales";

export const debtStatusEnum = pgEnum("debt_status", ["pending", "partial", "paid"]);

export const debtsTable = pgTable("debts", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  saleId: integer("sale_id").references(() => salesTable.id),
  originalAmount: numeric("original_amount", { precision: 12, scale: 2 }).notNull(),
  remainingAmount: numeric("remaining_amount", { precision: 12, scale: 2 }).notNull(),
  status: debtStatusEnum("status").notNull().default("pending"),
  dueDate: date("due_date"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const debtPaymentsTable = pgTable("debt_payments", {
  id: serial("id").primaryKey(),
  debtId: integer("debt_id").notNull().references(() => debtsTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  note: text("note"),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDebtSchema = createInsertSchema(debtsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDebtPaymentSchema = createInsertSchema(debtPaymentsTable).omit({ id: true });
export type InsertDebt = z.infer<typeof insertDebtSchema>;
export type InsertDebtPayment = z.infer<typeof insertDebtPaymentSchema>;
export type Debt = typeof debtsTable.$inferSelect;
export type DebtPayment = typeof debtPaymentsTable.$inferSelect;
