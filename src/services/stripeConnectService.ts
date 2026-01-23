import { stripe } from '../lib/stripe';
import { prisma } from '../lib/prisma';

export const createConnectAccount = async (clerkUserId: string, email: string) => {
  // Find user
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // If user already has a Stripe account, return it
  if (user.stripeAccountId) {
    return user.stripeAccountId;
  }

  // Create new Stripe Connect account
  const account = await stripe.accounts.create({
    type: 'express',
    email: email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  // Save Stripe account ID to database
  await prisma.user.update({
    where: { id: user.id },
    data: { stripeAccountId: account.id },
  });

  return account.id;
};

export const createAccountLink = async (
  accountId: string,
  refreshUrl: string,
  returnUrl: string
) => {
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });

  return accountLink.url;
};

export const getAccountStatus = async (clerkUserId: string) => {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
  });

  if (!user || !user.stripeAccountId) {
    return {
      hasAccount: false,
      onboardingComplete: false,
      chargesEnabled: false,
      payoutsEnabled: false,
    };
  }

  // Get account details from Stripe
  const account = await stripe.accounts.retrieve(user.stripeAccountId);

  const onboardingComplete = account.details_submitted || false;

  // Update user in database if onboarding is complete
  if (onboardingComplete && !user.stripeOnboardingComplete) {
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeOnboardingComplete: true },
    });
  }

  return {
    hasAccount: true,
    onboardingComplete,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    accountId: user.stripeAccountId,
  };
};

export const createDashboardLink = async (accountId: string) => {
  const link = await stripe.accounts.createLoginLink(accountId);
  return link.url;
};