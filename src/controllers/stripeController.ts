import { Request, Response } from 'express';
import * as stripeService from '../services/stripeService';
import { getAuth } from '@clerk/express';
import { prisma } from '../lib/prisma';

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
