import { Router } from 'express';
import { requireAuth } from '@clerk/express';
import * as stripeController from '../controllers/stripeController';
import * as stripeConnectController from '../controllers/stripeConnectController';


const router = Router();

// Public route - no auth required for checkout
router.post('/checkout', stripeController.createCheckoutSession);

router.post('/connect/onboard', requireAuth(), stripeConnectController.createOnboardingLink);
router.get('/connect/status', requireAuth(), stripeConnectController.getConnectStatus);
router.post('/connect/dashboard', requireAuth(), stripeConnectController.createDashboardLink);

export default router;