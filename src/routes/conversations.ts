import { Router } from 'express';
import { requireAuth } from '@clerk/express';
import * as conversationController from '../controllers/conversationController';

const router = Router();

router.post('/message', conversationController.createMessage);
router.get('/guest/:token', conversationController.getGuestConversation);
router.post('/guest/:token/message', conversationController.createGuestMessage);

router.use(requireAuth());
router.get('/', conversationController.getConversations);
router.get('/unread-count', conversationController.getUnreadCount);
router.post('/mark-all-read', conversationController.markAllRead);
router.get('/:id/messages', conversationController.getConversationMessages);
router.post('/:id/read', conversationController.markConversationRead);

export default router;
