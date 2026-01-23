import { Router } from 'express';
import { requireAuth } from '@clerk/express';
import * as notificationsController from '../controllers/notificationsController';

const router = Router();

router.use(requireAuth());
router.get('/', notificationsController.getNotifications);
router.get('/unread-count', notificationsController.getUnreadCount);
router.post('/:id/read', notificationsController.markAsRead);
router.post('/mark-all-read', notificationsController.markAllAsRead);

export default router;