import { Router } from 'express';
import * as stripeController from '../controllers/stripeController';

const router = Router();

// Public route - no auth required for checkout
router.post('/checkout', stripeController.createCheckoutSession);

export default router;