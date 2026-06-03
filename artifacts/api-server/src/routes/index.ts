import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import productsRouter from "./products";
import salesRouter from "./sales";
import customersRouter from "./customers";
import debtsRouter from "./debts";
import dashboardRouter from "./dashboard";
import stockRouter from "./stock";
import paymentsRouter from "./payments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(productsRouter);
router.use(salesRouter);
router.use(customersRouter);
router.use(debtsRouter);
router.use(dashboardRouter);
router.use(stockRouter);
router.use(paymentsRouter);

export default router;
