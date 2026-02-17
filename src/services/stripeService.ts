import { stripe } from "../lib/stripe";
import { prisma } from "../lib/prisma";

const PLATFORM_FEE_PERCENTAGE = 0.1; // 10% platform fee

interface CreateCheckoutSessionData {
  itemId: string;
  buyerEmail: string;
  successUrl: string;
  cancelUrl: string;
}

interface CreatePaymentIntentData {
  itemId: string;
  buyerEmail?: string;
  idempotencyKey?: string;
}

interface RefundOrderData {
  orderId: string;
  amount?: number;
  refundPlatformFee?: boolean;
}

export const createCheckoutSession = async (
  data: CreateCheckoutSessionData
) => {
  // Get item and store owner
  const item = await prisma.item.findUnique({
    where: { id: data.itemId },
    include: {
      store: {
        include: {
          user: true,
        },
      },
      images: {
        orderBy: { position: "asc" },
        take: 1,
      },
    },
  });

  if (!item) {
    throw new Error("Item not found");
  }

  if (!item.store.user.stripeAccountId) {
    throw new Error("Store owner has not set up payments");
  }

  if (!item.store.user.stripeOnboardingComplete) {
    throw new Error("Store owner has not completed payment setup");
  }

  const amount = Number(item.price);
  const platformFee = Math.round(amount * PLATFORM_FEE_PERCENTAGE * 100); // in cents
  const amountInCents = Math.round(amount * 100); // in cents

  // Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: data.buyerEmail,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: item.name,
            ...(item.description && { description: item.description }), // Only add if exists
            ...(item.images[0]?.url && { images: [item.images[0].url] }),
          },
          unit_amount: amountInCents,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: platformFee,
      transfer_data: {
        destination: item.store.user.stripeAccountId,
      },
    },
    success_url: data.successUrl,
    cancel_url: data.cancelUrl,
    metadata: {
      itemId: item.id,
      storeId: item.store.id,
      platformFee: platformFee.toString(),
    },
  });

  // Create order in database
  await prisma.order.create({
    data: {
      itemId: item.id,
      buyerEmail: data.buyerEmail,
      amount: item.price,
      platformFee: platformFee / 100, // back to dollars
      stripeSessionId: session.id,
      status: "pending",
    },
  });

  return session;
};

export const createPaymentIntent = async (data: CreatePaymentIntentData) => {
  const item = await prisma.item.findUnique({
    where: { id: data.itemId },
    include: {
      store: {
        include: {
          user: true,
        },
      },
      images: {
        orderBy: { position: "asc" },
        take: 1,
      },
    },
  });

  if (!item) {
    throw new Error("Item not found");
  }

  if (!item.store.user.stripeAccountId) {
    throw new Error("Store owner has not set up payments");
  }

  if (!item.store.user.stripeOnboardingComplete) {
    throw new Error("Store owner has not completed payment setup");
  }

  const amount = Number(item.price);
  const platformFee = Math.round(amount * PLATFORM_FEE_PERCENTAGE * 100); // in cents
  const amountInCents = Math.round(amount * 100); // in cents

  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: amountInCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      ...(data.buyerEmail && { receipt_email: data.buyerEmail }),
      application_fee_amount: platformFee,
      transfer_data: {
        destination: item.store.user.stripeAccountId,
      },
      metadata: {
        itemId: item.id,
        storeId: item.store.id,
        platformFee: platformFee.toString(),
        ...(data.buyerEmail && { buyerEmail: data.buyerEmail }),
      },
    },
    data.idempotencyKey ? { idempotencyKey: data.idempotencyKey } : undefined
  );

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  };
};

export const getOrderBySessionId = async (sessionId: string) => {
  return prisma.order.findUnique({
    where: { stripeSessionId: sessionId },
    include: {
      item: {
        include: {
          store: true,
          images: true,
        },
      },
    },
  });
};

export const getOrderByPaymentIntentId = async (paymentIntentId: string) => {
  return prisma.order.findUnique({
    where: { stripePaymentId: paymentIntentId },
    include: {
      item: {
        include: {
          store: true,
          images: true,
        },
      },
    },
  });
};

export const updateOrderEmailByPaymentIntentId = async (
  paymentIntentId: string,
  buyerEmail: string
) => {
  return prisma.order.updateMany({
    where: { stripePaymentId: paymentIntentId },
    data: { buyerEmail },
  });
};

export const updateOrderStatus = async (
  sessionId: string,
  status: string,
  paymentIntentId?: string
) => {
  return prisma.order.update({
    where: { stripeSessionId: sessionId },
    data: {
      status,
      ...(paymentIntentId && { stripePaymentId: paymentIntentId }),
    },
  });
};

export const updateOrderStatusByPaymentIntent = async (
  paymentIntentId: string,
  status: string
) => {
  return prisma.order.update({
    where: { stripePaymentId: paymentIntentId },
    data: {
      status,
    },
  });
};

export const createOrderFromPaymentIntent = async (
  paymentIntent: {
    id: string;
    amount: number;
    receipt_email: string | null;
    metadata: Record<string, string>;
    shipping?: {
      name?: string | null;
      address?: {
        line1?: string | null;
        line2?: string | null;
        city?: string | null;
        state?: string | null;
        postal_code?: string | null;
        country?: string | null;
      } | null;
    } | null;
  }
) => {
  const existing = await prisma.order.findUnique({
    where: { stripePaymentId: paymentIntent.id },
    include: {
      item: {
        include: { store: true },
      },
    },
  });

  if (existing) {
    return existing;
  }

  const itemId = paymentIntent.metadata?.itemId;
  if (!itemId) {
    throw new Error("Missing itemId metadata on payment intent");
  }

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: { store: true },
  });

  if (!item) {
    throw new Error("Item not found for payment intent");
  }

  const platformFeeCents =
    paymentIntent.metadata?.platformFee
      ? Number(paymentIntent.metadata.platformFee)
      : Math.round(Number(item.price) * PLATFORM_FEE_PERCENTAGE * 100);

  const buyerEmail =
    paymentIntent.receipt_email ||
    paymentIntent.metadata?.buyerEmail ||
    "";

  try {
  const order = await prisma.order.create({
    data: {
      itemId: item.id,
      buyerEmail,
      amount: item.price,
      platformFee: platformFeeCents / 100,
      stripeSessionId: paymentIntent.id,
      stripePaymentId: paymentIntent.id,
      status: "paid",
      shippingAddress: paymentIntent.shipping ?? null,
    },
      include: {
        item: {
          include: { store: true },
        },
      },
    });

    return order;
  } catch (error: any) {
    if (error?.code === "P2002") {
      const fallback = await prisma.order.findUnique({
        where: { stripePaymentId: paymentIntent.id },
        include: { item: { include: { store: true } } },
      });
      if (fallback) return fallback;
    }
    throw error;
  }
};

export const refundOrder = async (data: RefundOrderData) => {
  // Get the order with store info
  const order = await prisma.order.findUnique({
    where: { id: data.orderId },
    include: {
      item: {
        include: {
          store: {
            include: {
              user: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  if (!order.stripePaymentId) {
    throw new Error("No payment ID found for this order");
  }

  if (order.status === "refunded") {
    throw new Error("Order already refunded");
  }

  if (!order.item.store.user.stripeAccountId) {
    throw new Error("Store owner Stripe account not found");
  }

  // Calculate refund amount
  const refundAmountInCents = data.amount
    ? Math.round(data.amount * 100)
    : undefined; // undefined means full refund

  // Destination charge: PaymentIntent lives on the platform account.
  // Refund from the platform and reverse the transfer + app fee.
  const paymentIntent = await stripe.paymentIntents.retrieve(order.stripePaymentId);

  if (!paymentIntent.latest_charge) {
    throw new Error("No charge found for this payment");
  }

  const refund = await stripe.refunds.create({
    charge:
      typeof paymentIntent.latest_charge === "string"
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge.id,
    ...(refundAmountInCents && { amount: refundAmountInCents }),
    refund_application_fee: data.refundPlatformFee ?? true, // default to refunding platform fee
    reverse_transfer: true,
  });

  // Update order in database
  const updatedOrder = await prisma.order.update({
    where: { id: data.orderId },
    data: {
      status:
        refund.amount === Math.round(Number(order.amount) * 100)
          ? "refunded"
          : "partially_refunded",
      refundedAt: new Date(),
      stripeRefundId: refund.id,
      refundAmount: refund.amount / 100, // convert back to dollars
    },
  });

  return { refund, order: updatedOrder };
};
