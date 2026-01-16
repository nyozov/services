import { Request, Response } from 'express';
import * as userService from '../services/userService';

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

export const syncUser = async (req: Request, res: Response) => {
  try {
    const { clerkUserId, email, name } = req.body;

    if (!clerkUserId || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const user = await userService.syncUser({ clerkUserId, email, name });
    res.json(user);
  } catch (error) {
    console.error('Error syncing user:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};
