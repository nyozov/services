import { Router } from 'express';
import { requireAuth } from '@clerk/express';
import * as storesController from '../controllers/storesController';

const router = Router();

// Public routes
router.get('/:slug', storesController.getStoreBySlug);
router.get('/:slug/items', storesController.getStoreItems);
router.post("/:slug/view", storesController.trackView);


// Protected routes (require authentication)
router.use(requireAuth());
router.post('/', storesController.createStore);
router.get('/', storesController.getUserStores);
router.patch('/:id', storesController.updateStore);

export default router;
