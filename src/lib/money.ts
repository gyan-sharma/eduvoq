export function formatInrPaise(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export function orderTotals(args: {
  lines: Array<{ qty: number; unitPaise: number }>;
  shippingPaise: number;
  taxPaise?: number;
}): {
  subtotalPaise: number;
  taxPaise: number;
  shippingPaise: number;
  totalPaise: number;
} {
  const subtotalPaise = args.lines.reduce(
    (sum, line) => sum + line.qty * line.unitPaise,
    0,
  );
  const taxPaise = args.taxPaise ?? 0;
  return {
    subtotalPaise,
    taxPaise,
    shippingPaise: args.shippingPaise,
    totalPaise: subtotalPaise + taxPaise + args.shippingPaise,
  };
}
