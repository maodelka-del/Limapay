import { Router } from "express";
import { InitiateDiamondPayBody, GetDiamondPayStatusParams } from "@workspace/api-zod";
import { diamondPayService, DiamondPayOperator } from "../lib/diamondpay";
import { requireAuth } from "../lib/auth";

const router = Router();

router.post("/payments/diamondpay/initiate", requireAuth, async (req, res): Promise<void> => {
  const parsed = InitiateDiamondPayBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const result = await diamondPayService.initiatePayment(
      parsed.data.amount,
      parsed.data.operator as DiamondPayOperator | undefined,
      parsed.data.saleId,
      parsed.data.phoneNumber
    );
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ err: message }, "DiamondPay initiate failed");
    res.status(502).json({ error: message });
  }
});

router.get("/payments/diamondpay/:transactionId/status", requireAuth, async (req, res): Promise<void> => {
  const params = GetDiamondPayStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  try {
    const result = await diamondPayService.getTransactionStatus(params.data.transactionId);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: message });
  }
});

export default router;
