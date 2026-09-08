import {
  FileAcl,
  FileOwnerType,
  OrderStatus,
  Prisma,
  ProductType,
  type Address,
} from "@prisma/client";
import { orderTotals } from "@/lib/money";
import {
  DEFAULT_METRO_PAISE,
  DEFAULT_REST_PAISE,
  SHIPPING_METRO_SLUG,
  SHIPPING_REST_SLUG,
  shippingBand,
  type ShippingBand,
} from "@/lib/shipping";
import {
  GST_TAX_PAISE,
  ORDER_HOLD_MS,
  canDecrementStock,
  isPlaceholderCatalogKey,
} from "@/lib/types/commerce";
import { prisma } from "@/server/db";
import { allowReleaseExpiredPayment } from "@/server/payments";

export class CommerceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommerceError";
  }
}

export const catalogWhere: Prisma.ProductWhereInput = {
  isActive: true,
  NOT: {
    OR: [
      { sku: { contains: "i-m-a-product" } },
      { slug: { contains: "i-m-a-product" } },
      { name: { contains: "i-m-a-product" } },
    ],
  },
};

type DbClient = Prisma.TransactionClient | typeof prisma;

type LockedProduct = {
  id: string;
  slug: string;
  name: string;
  type: ProductType;
  pricePaise: number;
  sku: string;
  stock: number | null;
  hsnSac: string | null;
  isActive: number | boolean;
};

export async function getOrCreateCart(userId: string, db: DbClient = prisma) {
  const existing = await db.cart.findUnique({ where: { userId } });
  if (existing) return existing;
  return db.cart.create({ data: { userId } });
}

export async function loadCart(userId: string) {
  return prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: { product: true },
        orderBy: { id: "asc" },
      },
    },
  });
}

export async function productImagesByOwner(
  productIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (productIds.length === 0) return map;
  const files = await prisma.fileObject.findMany({
    where: {
      ownerType: FileOwnerType.PRODUCT,
      ownerId: { in: productIds },
      acl: FileAcl.PUBLIC,
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, ownerId: true },
  });
  for (const file of files) {
    if (!map.has(file.ownerId)) map.set(file.ownerId, file.id);
  }
  return map;
}

export async function loadShippingRates(): Promise<{
  metro: number;
  rest: number;
}> {
  const rows = await prisma.shippingRate.findMany({
    where: { slug: { in: [SHIPPING_METRO_SLUG, SHIPPING_REST_SLUG] } },
  });
  const metro =
    rows.find((row) => row.slug === SHIPPING_METRO_SLUG)?.paise ??
    DEFAULT_METRO_PAISE;
  const rest =
    rows.find((row) => row.slug === SHIPPING_REST_SLUG)?.paise ??
    DEFAULT_REST_PAISE;
  return { metro, rest };
}

export function quoteShipping(
  address: Pick<Address, "city" | "postalCode">,
  rates: { metro: number; rest: number },
): { band: ShippingBand; shippingPaise: number } {
  const band = shippingBand({
    city: address.city,
    postalCode: address.postalCode,
  });
  return {
    band,
    shippingPaise: band === SHIPPING_METRO_SLUG ? rates.metro : rates.rest,
  };
}

export async function releaseExpiredPendingOrders(
  now = new Date(),
): Promise<number> {
  const expired = await prisma.order.findMany({
    where: {
      status: OrderStatus.PENDING_PAYMENT,
      expiresAt: { lte: now },
    },
    select: { id: true, razorpayOrderId: true },
  });
  let released = 0;
  for (const row of expired) {
    if (!(await allowReleaseExpiredPayment(row.razorpayOrderId))) continue;
    const did = await cancelPendingOrderInTx(row.id);
    if (did) released += 1;
  }
  return released;
}

async function cancelPendingOrderInTx(orderId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || order.status !== OrderStatus.PENDING_PAYMENT) return false;

    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: OrderStatus.PENDING_PAYMENT },
      data: { status: OrderStatus.CANCELLED },
    });
    if (claimed.count !== 1) return false;

    const productIds = [...new Set(order.items.map((item) => item.productId))].sort();
    if (productIds.length > 0) {
      await lockProducts(tx, productIds);
    }
    for (const item of order.items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { stock: true },
      });
      if (product?.stock == null) continue;
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.qty } },
      });
    }
    return true;
  });
}

export async function cancelPendingOrderForUser(
  orderId: string,
  userId: string,
): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { userId: true, status: true },
  });
  if (!order || order.userId !== userId) {
    throw new CommerceError("Order not found.");
  }
  if (order.status !== OrderStatus.PENDING_PAYMENT) {
    throw new CommerceError("Only pending-payment orders can be cancelled.");
  }
  return cancelPendingOrderInTx(orderId);
}

async function lockProducts(
  tx: Prisma.TransactionClient,
  productIds: string[],
): Promise<Map<string, LockedProduct>> {
  const rows = await tx.$queryRaw<LockedProduct[]>`
    SELECT id, slug, name, type, pricePaise, sku, stock, hsnSac, isActive
    FROM Product
    WHERE id IN (${Prisma.join(productIds)})
    FOR UPDATE
  `;
  const map = new Map<string, LockedProduct>();
  for (const row of rows) map.set(row.id, row);
  return map;
}

/** Cart row first, then line items — serializes concurrent placeOrder. */
async function lockCartForUpdate(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<{ cartId: string; items: Array<{ productId: string; qty: number }> }> {
  const carts = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM Cart WHERE userId = ${userId} FOR UPDATE
  `;
  const cartId = carts[0]?.id;
  if (!cartId) return { cartId: "", items: [] };
  const items = await tx.$queryRaw<Array<{ productId: string; qty: number }>>`
    SELECT productId, qty FROM CartItem WHERE cartId = ${cartId} FOR UPDATE
  `;
  return { cartId, items };
}

function sellableProduct(row: LockedProduct) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: row.type,
    pricePaise: row.pricePaise,
    sku: row.sku,
    stock: row.stock,
    hsnSac: row.hsnSac,
    isActive: Boolean(row.isActive),
  };
}

export async function placeOrderInTransaction(args: {
  userId: string;
  address: Address | null;
  buyerGstin: string | null;
  physicalEnabled: boolean;
}): Promise<{ id: string }> {
  const rates = await loadShippingRates();

  return prisma.$transaction(
    async (tx) => {
    const { cartId, items } = await lockCartForUpdate(tx, args.userId);
    if (!cartId || items.length === 0) {
      throw new CommerceError("Your cart is empty.");
    }

    const openUnpaid = await tx.order.findFirst({
      where: {
        userId: args.userId,
        status: OrderStatus.PENDING_PAYMENT,
      },
      select: { id: true },
    });
    if (openUnpaid) {
      throw new CommerceError(
        "You already have an unpaid order. Pay or cancel it before placing another.",
      );
    }

    const productIds = [...new Set(items.map((item) => item.productId))].sort();
    const locked = await lockProducts(tx, productIds);
    const lines: Array<{
      productId: string;
      qty: number;
      unitPaise: number;
      taxPaise: number;
      hsnSac: string | null;
      type: ProductType;
    }> = [];

    for (const item of items) {
      const row = locked.get(item.productId);
      if (!row) throw new CommerceError("A product in your cart is no longer available.");
      const product = sellableProduct(row);
      if (
        !product.isActive ||
        isPlaceholderCatalogKey(product.sku) ||
        isPlaceholderCatalogKey(product.slug)
      ) {
        throw new CommerceError("A product in your cart is no longer available.");
      }
      if (product.type === ProductType.PHYSICAL && !args.physicalEnabled) {
        throw new CommerceError("Physical shipping is paused.");
      }
      if (!canDecrementStock(product.stock, item.qty)) {
        throw new CommerceError(
          product.stock === 0
            ? `${product.name} is out of stock.`
            : `Only ${product.stock} left of ${product.name}.`,
        );
      }
      lines.push({
        productId: product.id,
        qty: item.qty,
        unitPaise: product.pricePaise,
        taxPaise: GST_TAX_PAISE,
        hsnSac: product.hsnSac,
        type: product.type,
      });
    }

    const hasPhysical = lines.some((line) => line.type === ProductType.PHYSICAL);
    if (hasPhysical && !args.address) {
      throw new CommerceError("An India shipping address is required.");
    }
    const shipping =
      hasPhysical && args.address
        ? quoteShipping(args.address, rates)
        : { band: SHIPPING_REST_SLUG, shippingPaise: 0 };
    const totals = orderTotals({
      lines,
      shippingPaise: shipping.shippingPaise,
      taxPaise: GST_TAX_PAISE,
    });

    for (const line of lines) {
      const row = locked.get(line.productId);
      if (!row || row.stock == null) continue;
      const updated = await tx.product.updateMany({
        where: { id: line.productId, stock: { gte: line.qty } },
        data: { stock: { decrement: line.qty } },
      });
      if (updated.count !== 1) {
        throw new CommerceError("Stock changed while placing this order. Try again.");
      }
    }

    const order = await tx.order.create({
      data: {
        userId: args.userId,
        status: OrderStatus.PENDING_PAYMENT,
        subtotalPaise: totals.subtotalPaise,
        taxPaise: GST_TAX_PAISE,
        shippingPaise: totals.shippingPaise,
        totalPaise: totals.totalPaise,
        currency: "INR",
        invoiceNumber: null,
        buyerGstin: args.buyerGstin,
        shippingAddressId: hasPhysical && args.address ? args.address.id : null,
        expiresAt: new Date(Date.now() + ORDER_HOLD_MS),
        items: {
          create: lines.map((line) => ({
            productId: line.productId,
            qty: line.qty,
            unitPaise: line.unitPaise,
            taxPaise: GST_TAX_PAISE,
            hsnSac: line.hsnSac,
          })),
        },
      },
      select: { id: true },
    });

    await tx.cartItem.deleteMany({ where: { cartId } });
    return order;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}
