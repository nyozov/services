import { Request, Response } from 'express';
import { getAuth } from '@clerk/express';
import * as stripeConnectService from '../services/stripeConnectService';

export const createOnboardingLink = async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user email from Clerk or request body
    const userEmail = req.body.email || `${userId}@temp.com`; // Fallback email

    const origin = req.headers.origin || 'http://localhost:3001';

    // Create or get Connect account
    const accountId = await stripeConnectService.createConnectAccount(
      userId,
      userEmail
    );

    // Create onboarding link
    const url = await stripeConnectService.createAccountLink(
      accountId,
      `${origin}/stores?stripe=refresh`,
      `${origin}/stores?stripe=success`
    );

    res.json({ url });
  } catch (error) {
    console.error('Error creating onboarding link:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create onboarding link',
    });
  }
};

export const createAccountSession = async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userEmail = req.body.email || `${userId}@temp.com`;

    const accountId = await stripeConnectService.createConnectAccount(
      userId,
      userEmail
    );

    const clientSecret = await stripeConnectService.createAccountSession(
      accountId
    );

    res.json({ clientSecret });
  } catch (error) {
    console.error('Error creating account session:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create account session',
    });
  }
};

export const getConnectStatus = async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const status = await stripeConnectService.getAccountStatus(userId);
    res.json(status);
  } catch (error) {
    console.error('Error getting connect status:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get connect status',
    });
  }
};

export const createDashboardLink = async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const status = await stripeConnectService.getAccountStatus(userId);

    if (!status.hasAccount || !status.accountId) {
      return res.status(400).json({ error: 'No Stripe account found' });
    }

    const url = await stripeConnectService.createDashboardLink(status.accountId);
    res.json({ url });
  } catch (error) {
    console.error('Error creating dashboard link:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create dashboard link',
    });
  }
};
