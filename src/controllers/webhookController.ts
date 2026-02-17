import { Request, Response } from "express";
import Stripe from "stripe";
import { stripe } from "../lib/stripe";
import * as stripeService from "../services/stripeService";
import * as notificationService from "../services/notificationService";
import { prisma } from "../lib/prisma";

export const handleStripeWebhook = async (req: Request, res: Response) => {

  const sig = req.headers["stripe-signature"];

  if (!sig) {
    return res.status(400).send("Missing stripe-signature header");
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return res
      .status(400)
      .send(
        `Webhook Error: ${err instanceof Error ? err.message : "Unknown error"}`
      );
  }

  try {

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Only mark paid if Stripe says it's paid
        if (session.payment_status !== "paid") {
          console.log(
            "Checkout session completed but not paid:",
            session.id,
            "Status:",
            session.payment_status
          );
          break;
        }

        // Fetch order FIRST (avoid Prisma throwing)
        const order = await stripeService.getOrderBySessionId(session.id);

        if (!order) {
          console.error("Order not found for session:", session.id);
          break;
        }

        // Idempotency guard (Stripe retries webhooks)
        if (order.status === "paid") {
          console.log("Order already marked paid:", order.id);
          break;
        }

        // Update order status
        console.log("Updating order status to paid for session:", session.id);
        await stripeService.updateOrderStatus(
          session.id,
          "paid",
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : undefined
        );
        console.log("Order status updated successfully");

        // Notify store owner
        console.log("Creating notification for store owner");
        const storeOwner = await prisma.user.findUnique({
          where: { id: order.item.store.userId },
        });

        if (!storeOwner) {
          console.error("Store owner not found for userId:", order.item.store.userId);
        } else {
          await notificationService.createNotification({
            userId: storeOwner.id,
            type: "order",
            title: "New Order Received!",
            message: `You have a new order for "${order.item.name}" from ${order.buyerEmail}`,
            orderId: order.id,
          });
          console.log("Notification created successfully");
        }

        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        const order = await stripeService.createOrderFromPaymentIntent({
          id: paymentIntent.id,
          amount: paymentIntent.amount,
          receipt_email: paymentIntent.receipt_email ?? null,
          metadata: paymentIntent.metadata || {},
          shipping: paymentIntent.shipping ?? null,
        });

        const storeOwner = await prisma.user.findUnique({
          where: { id: order.item.store.userId },
        });

        if (storeOwner) {
          await notificationService.createNotification({
            userId: storeOwner.id,
            type: "order",
            title: "New Order Received!",
            message: `You have a new order for "${order.item.name}" from ${order.buyerEmail}`,
            orderId: order.id,
          });
          console.log("Notification created successfully");
        }

        break;
      }

      case "payment_intent.payment_failed":
      case "payment_intent.canceled": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        const order = await stripeService.getOrderByPaymentIntentId(paymentIntent.id);

        if (!order) {
          console.log("Payment intent failed with no order:", paymentIntent.id);
          break;
        }

        if (order.status !== "pending") {
          break;
        }

        await stripeService.updateOrderStatusByPaymentIntent(paymentIntent.id, "cancelled");
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;

        const order = await stripeService.getOrderBySessionId(session.id);

        if (!order) {
          console.log("Expired session with no order:", session.id);
          break;
        }

        if (order.status !== "pending") {
          break;
        }

        await stripeService.updateOrderStatus(session.id, "cancelled");
        break;
      }

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    // IMPORTANT: acknowledge receipt only after successful handling
    return res.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook handler error:", err);
    // Tell Stripe to retry
    return res.status(500).send("Webhook handler failed");
  }
};
