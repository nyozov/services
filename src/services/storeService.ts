import { prisma } from '../lib/prisma';
import { redis } from "../lib/redis";

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

function getIp(req) {
  return (
    req.headers["x-forwarded-for"]?.toString().split(",")[0] ||
    req.socket.remoteAddress
  );
}

function isBot(userAgent: string) {
  return /bot|crawler|spider|preview|facebook|twitter|discord/i.test(userAgent);
}

export async function trackView(req) {
  const { slug } = req.params;

  const userAgent = req.headers["user-agent"] || "";
  if (isBot(userAgent)) return;

  const userId = req.user?.id; // if you have auth
  const ip = getIp(req);

  const viewerKey = userId ?? ip;
  if (!viewerKey) return;

  // Fetch store owner to avoid self-views
  const store = await prisma.store.findUnique({
    where: { slug },
    select: { id: true, userId: true },
  });

  if (!store) return;
  const storeId = store.id
  if (userId && store.userId === userId) return;

  const redisKey = `store:${storeId}:view:${viewerKey}`;

  const alreadyViewed = await redis.get(redisKey);
  if (alreadyViewed) return;

  // Mark as viewed for 24h
  await redis.set(redisKey, "1", "EX", 60 * 60 * 24);

  // Increment DB counter
  await prisma.store.update({
    where: { id: storeId },
    data: {
      viewCount: {
        increment: 1,
      },
    },
  });
}