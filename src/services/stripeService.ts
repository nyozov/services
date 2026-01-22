import { stripe } from "../lib/stripe";
import { prisma } from "../lib/prisma";

const PLATFORM_FEE_PERCENTAGE = 0.1; // 10% platform fee

interface CreateCheckoutSessionData {
  itemId: string;
  buyerEmail: string;
  successUrl: string;
  cancelUrl: string;
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
