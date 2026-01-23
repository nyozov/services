import { Request, Response } from 'express';
import { getAuth } from '@clerk/express';
import * as orderService from '../services/orderService';

export const getUserOrders = async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const orders = await orderService.getOrdersByClerkUserId(userId);
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};