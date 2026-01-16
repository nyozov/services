import { Router } from 'express';
import { requireAuth } from '@clerk/express';
import * as itemsController from '../controllers/itemsController';

const router = Router();

// Protected routes (require authentication)
router.use(requireAuth());
router.post('/', itemsController.createItem);
router.get('/store/:storeId', itemsController.getStoreItems);

export default router;