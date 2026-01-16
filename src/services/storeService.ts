import { prisma } from '../lib/prisma';

interface CreateStoreData {
  name: string;
  description?: string;
}

export const createStore = async (clerkUserId: string, data: CreateStoreData) => {
  // Find user in database
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Generate slug
  const slug = generateSlug(data.name);

  // Check for duplicate slug
  const existingStore = await prisma.store.findUnique({
    where: { slug },
  });

  const finalSlug = existingStore ? `${slug}-${Date.now()}` : slug;

  // Create store
  return prisma.store.create({
    data: {
      name: data.name,
      slug: finalSlug,
      description: data.description ?? null, // Convert undefined to null
      userId: user.id,
    },
  });
};

export const getStoresByClerkUserId = async (clerkUserId: string) => {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return prisma.store.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });
};

export const getStoreBySlug = async (slug: string) => {
  return prisma.store.findUnique({
    where: { slug },
    include: { user: true },
  });
};

const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};