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

const PROVIDER_MAP: Record<string, string> = {
  wave: "WAVE",
  orange_money: "ORANGE_MONEY",
  free_money: "FREE_MONEY",
};

const STATUS_MAP: Record<string, DiamondPayTransactionResult["status"]> = {
  pending: "pending",
  PENDING: "pending",
  processing: "pending",
  PROCESSING: "pending",
  confirmed: "confirmed",
  CONFIRMED: "confirmed",
  paid: "confirmed",
  PAID: "confirmed",
  success: "confirmed",
  SUCCESS: "confirmed",
  completed: "confirmed",
  COMPLETED: "confirmed",
  failed: "failed",
  FAILED: "failed",
  cancelled: "failed",
  CANCELLED: "failed",
  expired: "expired",
  EXPIRED: "expired",
};

export class DiamondPayService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey =
      process.env.DIAMANOPAY_API_KEY ??
      process.env.DIAMONDPAY_API_KEY ??
      "";
    this.baseUrl = (
      process.env.DIAMANOPAY_BASE_URL ??
      process.env.DIAMONDPAY_BASE_URL ??
      "https://api.diamanopay.com"
    ).replace(/\/+$/, "");
  }

  private authHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  async initiatePayment(
    amount: number,
    operator?: DiamondPayOperator,
    saleId?: number,
    phoneNumber?: string
  ): Promise<DiamondPayTransactionResult> {
    if (!this.apiKey) {
      logger.warn("DiamanoPay API key not configured — simulation mode");
      return this.simulateTransaction(amount, operator);
    }

    const reference = `LIMAPAY-${saleId ?? 0}-${Date.now()}`;
    const provider = operator
      ? (PROVIDER_MAP[operator] ?? operator.toUpperCase())
      : "WAVE";

    const body: Record<string, unknown> = {
      amount,
      provider,
      description: `Paiement LIMAPAY #${saleId ?? reference}`,
      customer_reference: reference,
      fee_on_customer: false,
    };

    if (phoneNumber) body.phone_number = phoneNumber;

    // success_url = page affichée après paiement réussi (certaines versions de l'API)
    const successUrl =
      process.env.DIAMANOPAY_SUCCESS_URL ??
      process.env.DIAMONDPAY_SUCCESS_URL;
    if (successUrl) body.success_url = successUrl;

    // redirect_url = redirection navigateur après paiement
    const redirectUrl =
      process.env.DIAMANOPAY_REDIRECT_URL ??
      process.env.DIAMONDPAY_REDIRECT_URL ??
      successUrl; // fallback vers success_url si redirect non défini
    if (redirectUrl) body.redirect_url = redirectUrl;

    // callback_url = alias de webhook selon certaines versions de l'API
    const callbackUrl =
      process.env.DIAMANOPAY_CALLBACK_URL ??
      process.env.DIAMONDPAY_CALLBACK_URL;
    if (callbackUrl) body.callback_url = callbackUrl;

    // webhook_url = notification serveur-à-serveur (POST asynchrone)
    const webhookUrl =
      process.env.DIAMANOPAY_WEBHOOK_URL ??
      process.env.DIAMONDPAY_WEBHOOK_URL ??
      callbackUrl; // fallback vers callback_url
    if (webhookUrl) body.webhook_url = webhookUrl;

    logger.info(
      { url: `${this.baseUrl}/api/charges`, provider, amount },
      "DiamanoPay → create charge"
    );

    let response: Response;
    let responseText: string;
    try {
      response = await fetch(`${this.baseUrl}/api/charges`, {
        method: "POST",
        headers: this.authHeaders(),
        body: JSON.stringify(body),
      });
      responseText = await response.text();
    } catch (fetchErr) {
      const msg =
        fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      logger.error({ err: msg }, "DiamanoPay → network error");
      throw new Error(`DiamanoPay réseau inaccessible: ${msg}`);
    }

    logger.info(
      { status: response.status, body: responseText },
      "DiamanoPay ← response"
    );

    if (!response.ok) {
      let detail = responseText;
      try {
        const err = JSON.parse(responseText) as Record<string, unknown>;
        detail = String(err.message ?? err.error ?? responseText);
      } catch {
        // keep raw text
      }
      throw new Error(`DiamanoPay ${response.status}: ${detail}`);
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(`DiamanoPay réponse non-JSON: ${responseText}`);
    }

    const inner = (data.data ?? data) as Record<string, unknown>;

    return {
      transactionId: String(
        inner.id ??
          inner.transaction_id ??
          inner.transactionId ??
          inner.uuid ??
          "unknown"
      ),
      status: "pending",
      amount,
      qrCodeUrl: (inner.qr_code_url ??
        inner.qrCodeUrl ??
        inner.qr_url ??
        null) as string | null,
      qrCodeData: (inner.qr_code_data ??
        inner.qrCodeData ??
        null) as string | null,
      paymentUrl: (inner.payment_url ??
        inner.paymentUrl ??
        inner.checkout_url ??
        inner.redirect_url ??
        inner.url ??
        inner.link ??
        null) as string | null,
      createdAt: new Date().toISOString(),
    };
  }

  async getTransactionStatus(
    transactionId: string
  ): Promise<DiamondPayTransactionResult> {
    if (!this.apiKey || transactionId.startsWith("SIM-")) {
      return this.simulateStatusCheck(transactionId);
    }

    let response: Response;
    let responseText: string;
    try {
      response = await fetch(
        `${this.baseUrl}/api/charges/${transactionId}`,
        { headers: this.authHeaders() }
      );
      responseText = await response.text();
    } catch (fetchErr) {
      throw new Error(
        `DiamanoPay réseau: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`
      );
    }

    if (!response.ok) {
      throw new Error(
        `DiamanoPay status ${response.status}: ${responseText}`
      );
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(`DiamanoPay réponse non-JSON: ${responseText}`);
    }

    const inner = (data.data ?? data) as Record<string, unknown>;
    const rawStatus = String(inner.status ?? "pending");

    return {
      transactionId: String(
        inner.id ??
          inner.transaction_id ??
          inner.transactionId ??
          transactionId
      ),
      status: STATUS_MAP[rawStatus] ?? "pending",
      amount: (inner.amount as number) ?? 0,
      qrCodeUrl: (inner.qr_code_url ??
        inner.qrCodeUrl ??
        inner.qr_url ??
        null) as string | null,
      qrCodeData: (inner.qr_code_data ??
        inner.qrCodeData ??
        null) as string | null,
      paymentUrl: (inner.payment_url ??
        inner.paymentUrl ??
        inner.checkout_url ??
        inner.redirect_url ??
        inner.url ??
        null) as string | null,
      createdAt: String(
        inner.created_at ?? inner.createdAt ?? new Date().toISOString()
      ),
    };
  }

  parseWebhookPayload(payload: Record<string, unknown>): {
    transactionId: string;
    status: DiamondPayTransactionResult["status"];
    amount: number;
  } {
    const inner = (payload.data ?? payload) as Record<string, unknown>;
    const rawStatus = String(
      inner.status ?? payload.status ?? "pending"
    );
    return {
      transactionId: String(
        inner.id ?? inner.transaction_id ?? inner.transactionId ?? ""
      ),
      status: STATUS_MAP[rawStatus] ?? "pending",
      amount: (inner.amount as number) ?? 0,
    };
  }

  private simulateTransaction(
    amount: number,
    operator?: DiamondPayOperator
  ): DiamondPayTransactionResult {
    const transactionId = `SIM-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`;
    const qrCodeData = `diamanopay://pay?txn=${transactionId}&amount=${amount}&currency=XOF${operator ? `&operator=${operator}` : ""}`;
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

  private simulateStatusCheck(
    transactionId: string
  ): DiamondPayTransactionResult {
    const txnAge = transactionId.startsWith("SIM-")
      ? parseInt(transactionId.split("-")[1])
      : 0;
    const ageSeconds = (Date.now() - txnAge) / 1000;
    const status: DiamondPayTransactionResult["status"] =
      ageSeconds > 30 ? "confirmed" : "pending";
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
