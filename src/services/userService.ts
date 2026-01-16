import { prisma } from '../lib/prisma';

interface SyncUserData {
  clerkUserId: string;
  email: string;
  name?: string;
}

export const getAllUsers = async () => {
  return prisma.user.findMany();
};

export const syncUser = async (data: SyncUserData) => {
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { clerkUserId: data.clerkUserId },
  });

  if (existingUser) {
    return existingUser;
  }

  // Create new user
  return prisma.user.create({
    data: {
      clerkUserId: data.clerkUserId,
      email: data.email,
      name: data.name ?? null,
    },
  });
};