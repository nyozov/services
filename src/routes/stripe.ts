import { Router } from 'express';
import { requireAuth } from '@clerk/express';
import * as stripeController from '../controllers/stripeController';
import * as stripeConnectController from '../controllers/stripeConnectController';
import * as webhookController from '../controllers/webhookController';
import { stripe } from '../lib/stripe';
import * as stripeService from '../services/stripeService';
import { prisma } from '../lib/prisma';
import * as notificationService from '../services/notificationService';

const router = Router();

// Webhook route - raw body is handled at app level in index.ts, no auth required
router.post('/webhook', webhookController.handleStripeWebhook);

// Test endpoint to verify webhook route is accessible
router.get('/webhook/test', (req, res) => {
  res.json({ message: 'Webhook endpoint is reachable', timestamp: new Date().toISOString() });
});

// Debug endpoint to check session status manually
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const order = await stripeService.getOrderBySessionId(sessionId);
    
    res.json({
      session: {
        id: session.id,
        status: session.status,
        payment_status: session.payment_status,
        payment_intent: session.payment_intent,
        customer_email: session.customer_email,
      },
      order: order ? {
        id: order.id,
        status: order.status,
        stripeSessionId: order.stripeSessionId,
      } : null,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Public route - no auth required for checkout
router.post('/checkout', stripeController.createCheckoutSession);

// Public route - create payment intent for in-app checkout
router.post('/payment-intent', stripeController.createPaymentIntent);
router.post('/payment-intent/:paymentIntentId/email', stripeController.updatePaymentIntentEmail);
router.post('/payment-intent/:paymentIntentId/sync', stripeController.syncPaymentIntent);

// Refund order - auth required
router.post('/refund', requireAuth(), stripeController.refundOrder);

// Verify checkout session and update order (called by frontend after success redirect)
router.get('/verify-session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    console.log('🔍 Verifying session:', sessionId);
    console.log('   Status:', session.status);
    console.log('   Payment status:', session.payment_status);

    // Get order from database
    const order = await stripeService.getOrderBySessionId(sessionId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // If session is complete and paid, but order isn't marked paid yet, update it
    if (session.payment_status === 'paid' && session.status === 'complete' && order.status !== 'paid') {
      console.log('✅ Session is paid, updating order status');
      
      // Update order status (same logic as webhook)
      await stripeService.updateOrderStatus(
        sessionId,
        'paid',
        typeof session.payment_intent === 'string' ? session.payment_intent : undefined
      );

      // Notify store owner
      const storeOwner = await prisma.user.findUnique({
        where: { id: order.item.store.userId },
      });

      if (storeOwner) {
        await notificationService.createNotification({
          userId: storeOwner.id,
          type: 'order',
          title: 'New Order Received!',
          message: `You have a new order for "${order.item.name}" from ${order.buyerEmail}`,
          orderId: order.id,
        });
        console.log('✅ Notification sent');
      }

      // Fetch updated order
      const updatedOrder = await stripeService.getOrderBySessionId(sessionId);
      return res.json({ 
        success: true, 
        order: updatedOrder,
        session: {
          status: session.status,
          payment_status: session.payment_status,
        }
      });
    }

    // Return current status
    res.json({
      success: true,
      order: {
        id: order.id,
        status: order.status,
      },
      session: {
        status: session.status,
        payment_status: session.payment_status,
      },
      message: order.status === 'paid' ? 'Order already processed' : 'Payment pending',
    });
  } catch (error) {
    console.error('Error verifying session:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to verify session' 
    });
  }
});

router.post('/connect/onboard', requireAuth(), stripeConnectController.createOnboardingLink);
router.get('/connect/status', requireAuth(), stripeConnectController.getConnectStatus);
router.post('/connect/dashboard', requireAuth(), stripeConnectController.createDashboardLink);

export default router;
