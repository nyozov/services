import { Router } from 'express';
import userRoutes from './users';
import storeRoutes from './stores';
import itemRoutes from './items'
import stripeRoutes from './stripe'

const router = Router();

router.get('/', (req, res) => {
  res.json({ message: 'Services API' });
});

router.use('/users', userRoutes);
router.use('/stores', storeRoutes);
router.use('/items', itemRoutes)
router.use('/stripe', stripeRoutes)

export default router;
