import { logger } from "./logger";

export type DiamondPayOperator = "wave" | "orange_money" | "free_money";

export interface DiamondPayTransactionResult {
  transactionId: string;
  status: "pending" | "confirmed" | "failed" | "expired";
  amount: number;
  qrCodeUrl: string | null;
  qrCodeData: string | null;
  paymentUrl: string | null;
  createdAt: string;
}

export class DiamondPayService {
  private clientId: string;
  private clientSecret: string;
  private baseUrl: string;

  constructor() {
    this.clientId = process.env.DIAMONDPAY_API_KEY ?? "";
    this.clientSecret = process.env.DIAMONDPAY_API_SECRET ?? "";
    this.baseUrl = (process.env.DIAMONDPAY_BASE_URL ?? "https://api.diamondpay.sn/v1").replace(/\/+$/, "");
  }

  private authHeaders(): Record<string, string> {
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    return {
      "Content-Type": "application/json",
      "Authorization": `Basic ${credentials}`,
    };
  }

  async initiatePayment(
    amount: number,
    operator?: DiamondPayOperator,
    saleId?: number,
    phoneNumber?: string
  ): Promise<DiamondPayTransactionResult> {
    if (!this.clientId) {
      logger.warn("DiamondPay Client ID not configured — using simulation mode");
      return this.simulateTransaction(amount, operator);
    }

    const reference = `LIMAPAY-${saleId ?? 0}-${Date.now()}`;
    const body: Record<string, unknown> = {
      amount,
      currency: "XOF",
      reference,
    };
    if (operator) body.operator = operator;
    if (phoneNumber) body.phone_number = phoneNumber;
    if (process.env.DIAMONDPAY_CALLBACK_URL) body.callback_url = process.env.DIAMONDPAY_CALLBACK_URL;

    logger.info({ url: `${this.baseUrl}/transactions/initiate`, body }, "DiamondPay → request");

    let response: Response;
    let responseText: string;
    try {
      response = await fetch(`${this.baseUrl}/transactions/initiate`, {
        method: "POST",
        headers: this.authHeaders(),
        body: JSON.stringify(body),
      });
      responseText = await response.text();
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      logger.error({ err: msg }, "DiamondPay → network error");
      throw new Error(`DiamondPay réseau inaccessible: ${msg}`);
    }

    logger.info({ status: response.status, body: responseText }, "DiamondPay ← response");

    if (!response.ok) {
      throw new Error(`DiamondPay ${response.status}: ${responseText}`);
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(`DiamondPay réponse non-JSON: ${responseText}`);
    }

    return {
      transactionId: String(
        data.transaction_id ?? data.transactionId ?? data.id ?? data.uuid ?? "unknown"
      ),
      status: "pending",
      amount,
      qrCodeUrl: (data.qr_code_url ?? data.qrCodeUrl ?? data.qr_url ?? null) as string | null,
      qrCodeData: (data.qr_code_data ?? data.qrCodeData ?? null) as string | null,
      paymentUrl: (data.payment_url ?? data.paymentUrl ?? data.redirect_url ?? data.checkout_url ?? data.url ?? null) as string | null,
      createdAt: new Date().toISOString(),
    };
  }

  async getTransactionStatus(transactionId: string): Promise<DiamondPayTransactionResult> {
    if (!this.clientId) {
      return this.simulateStatusCheck(transactionId);
    }

    let response: Response;
    let responseText: string;
    try {
      response = await fetch(`${this.baseUrl}/transactions/${transactionId}`, {
        headers: this.authHeaders(),
      });
      responseText = await response.text();
    } catch (fetchErr) {
      throw new Error(`DiamondPay réseau: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`);
    }

    if (!response.ok) {
      throw new Error(`DiamondPay status ${response.status}: ${responseText}`);
    }

    const data = JSON.parse(responseText) as Record<string, unknown>;

    return {
      transactionId: String(data.transaction_id ?? data.transactionId ?? data.id ?? transactionId),
      status: (data.status as DiamondPayTransactionResult["status"]) ?? "pending",
      amount: (data.amount as number) ?? 0,
      qrCodeUrl: (data.qr_code_url ?? data.qrCodeUrl ?? data.qr_url ?? null) as string | null,
      qrCodeData: (data.qr_code_data ?? data.qrCodeData ?? null) as string | null,
      paymentUrl: (data.payment_url ?? data.paymentUrl ?? data.redirect_url ?? null) as string | null,
      createdAt: String(data.created_at ?? data.createdAt ?? new Date().toISOString()),
    };
  }

  private simulateTransaction(amount: number, operator?: DiamondPayOperator): DiamondPayTransactionResult {
    const transactionId = `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const qrCodeData = `diamondpay://pay?txn=${transactionId}&amount=${amount}&currency=XOF${operator ? `&operator=${operator}` : ""}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrCodeData)}`;
    return {
      transactionId,
      status: "pending",
      amount,
      qrCodeUrl,
      qrCodeData,
      paymentUrl: null,
      createdAt: new Date().toISOString(),
    };
  }

  private simulateStatusCheck(transactionId: string): DiamondPayTransactionResult {
    const txnAge = transactionId.startsWith("SIM-") ? parseInt(transactionId.split("-")[1]) : 0;
    const ageSeconds = (Date.now() - txnAge) / 1000;
    const status: DiamondPayTransactionResult["status"] = ageSeconds > 30 ? "confirmed" : "pending";
    return {
      transactionId,
      status,
      amount: 0,
      qrCodeUrl: null,
      qrCodeData: null,
      paymentUrl: null,
      createdAt: new Date(txnAge || Date.now()).toISOString(),
    };
  }
}

export const diamondPayService = new DiamondPayService();
