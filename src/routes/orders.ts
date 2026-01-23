import { Router } from 'express';
import { requireAuth } from '@clerk/express';
import * as ordersController from '../controllers/ordersController';

const router = Router();

router.use(requireAuth());
router.get('/', ordersController.getUserOrders);

export default router;