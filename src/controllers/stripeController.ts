import { Request, Response } from 'express';
import * as stripeService from '../services/stripeService';

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