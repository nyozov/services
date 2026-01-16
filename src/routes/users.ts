import { Router } from 'express';
import * as usersController from '../controllers/usersController'

const router = Router();

// Get all users
router.get('/', usersController.getAllUsers);

// Sync user from Clerk
router.post('/sync', usersController.syncUser);

export default router;