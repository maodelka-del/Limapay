export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-SN", {
    style: "currency",
    currency: "XOF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace("XOF", "FCFA").replace("F CFA", "FCFA").trim();
}

export function formatDate(dateString: string | undefined): string {
  if (!dateString) return "";
  return new Intl.DateTimeFormat("fr-SN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(dateString));
}

export function formatShortDate(dateString: string | undefined): string {
  if (!dateString) return "";
  return new Intl.DateTimeFormat("fr-SN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(dateString));
}
