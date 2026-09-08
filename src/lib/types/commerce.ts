export type ProductType = "PHYSICAL" | "DIGITAL";
export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "FULFILLING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export const ORDER_HOLD_MS = 15 * 60 * 1000;
export const MAX_CART_QTY = 20;
export const GST_TAX_PAISE = 0;

export function isPlaceholderCatalogKey(value: string): boolean {
  return value.toLowerCase().includes("i-m-a-product");
}

export function canDecrementStock(stock: number | null, qty: number): boolean {
  if (!Number.isInteger(qty) || qty < 1) return false;
  if (stock == null) return true;
  return stock >= qty;
}

export function nextStock(stock: number | null, qty: number): number | null {
  if (stock == null) return null;
  return stock - qty;
}

export function orderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case "PENDING_PAYMENT":
      return "Pending payment";
    case "PAID":
      return "Paid";
    case "FULFILLING":
      return "Fulfilling";
    case "SHIPPED":
      return "Shipped";
    case "DELIVERED":
      return "Delivered";
    case "CANCELLED":
      return "Cancelled";
    case "REFUNDED":
      return "Refunded";
    default:
      return status;
  }
}
