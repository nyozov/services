import { Router } from 'express';
import userRoutes from './users';
import storeRoutes from './stores';

const router = Router();

router.get('/', (req, res) => {
  res.json({ message: 'Services API' });
});

router.use('/users', userRoutes);
router.use('/stores', storeRoutes);

export default router;
