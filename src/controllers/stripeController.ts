import { Request, Response } from 'express';
import * as stripeService from '../services/stripeService';
import { getAuth } from '@clerk/express';
import { prisma } from '../lib/prisma';
import { stripe } from '../lib/stripe';
import * as notificationService from '../services/notificationService';

export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    const { itemId, buyerEmail } = req.body;

    if (!itemId || !buyerEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(buyerEmail)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const origin = req.headers.origin || 'http://localhost:3001';
    
    const session = await stripeService.createCheckoutSession({
      itemId,
      buyerEmail,
      successUrl: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/checkout/cancelled`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create checkout session',
    });
  }
};

export const createPaymentIntent = async (req: Request, res: Response) => {
  try {
    const { itemId, buyerEmail } = req.body;

    if (!itemId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Email validation
    if (buyerEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(buyerEmail)) {
        return res.status(400).json({ error: 'Invalid email address' });
      }
    }

    const { idempotencyKey } = req.body;

    const result = await stripeService.createPaymentIntent({
      itemId,
      buyerEmail,
      idempotencyKey,
    });

    res.json(result);
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create payment intent',
    });
  }
};

export const updatePaymentIntentEmail = async (req: Request, res: Response) => {
  try {
    const { paymentIntentId } = req.params;
    const { buyerEmail } = req.body;

    if (!paymentIntentId || !buyerEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(buyerEmail)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    await stripe.paymentIntents.update(paymentIntentId, {
      receipt_email: buyerEmail,
      metadata: { buyerEmail },
    });

    await stripeService.updateOrderEmailByPaymentIntentId(paymentIntentId, buyerEmail);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating payment intent email:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to update email',
    });
  }
};

export const syncPaymentIntent = async (req: Request, res: Response) => {
  try {
    const { paymentIntentId } = req.params;

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Payment intent ID is required' });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    let orderId: string | null = null;

    if (paymentIntent.status === 'succeeded') {
      const order = await stripeService.createOrderFromPaymentIntent({
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        receipt_email: paymentIntent.receipt_email ?? null,
        metadata: paymentIntent.metadata || {},
        shipping: paymentIntent.shipping ?? null,
      });
      orderId = order.id;

      const storeOwner = await prisma.user.findUnique({
        where: { id: order.item.store.userId },
      });

      if (storeOwner) {
        await notificationService.createNotification({
          userId: storeOwner.id,
          type: 'order',
          title: 'New Order Received!',
          message: `You have a new order for \"${order.item.name}\" from ${paymentIntent.receipt_email ?? order.buyerEmail}`,
          orderId: order.id,
        });
      }
    }

    res.json({ success: true, status: paymentIntent.status, orderId });
  } catch (error) {
    console.error('Error syncing payment intent:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to sync payment intent',
    });
  }
};

export const refundOrder = async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    const { orderId, amount, refundPlatformFee } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    if (amount !== undefined && (typeof amount !== 'number' || amount <= 0)) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    if (refundPlatformFee !== undefined && typeof refundPlatformFee !== 'boolean') {
      return res.status(400).json({ error: 'refundPlatformFee must be a boolean' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
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
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.item.store.user.clerkUserId !== userId) {
      return res.status(403).json({ error: 'You do not have access to this order' });
    }

    const result = await stripeService.refundOrder({
      orderId,
      amount,
      refundPlatformFee,
    });

    res.json(result);
  } catch (error) {
    console.error('Error refunding order:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to refund order',
    });
  }
};
