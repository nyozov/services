import { prisma } from '../lib/prisma';

export interface CreateItemData {
  storeId: string;
  name: string;
  description?: string | null;
  price: number;
  images?: {
    url: string;
    publicId: string;
    position?: number;
  }[];
}


export const verifyStoreAccess = async (clerkUserId: string, storeId: string): Promise<boolean> => {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
  });

  if (!user) {
    return false;
  }

  const store = await prisma.store.findFirst({
    where: {
      id: storeId,
      userId: user.id,
    },
  });

  return !!store;
};

export const createItem = async (data: CreateItemData) => {
  return prisma.item.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      price: data.price,
      storeId: data.storeId,

      ...(data.images && data.images.length > 0
        ? {
            images: {
              create: data.images.map((img, index) => ({
                url: img.url,
                publicId: img.publicId,
                position: img.position ?? index,
              })),
            },
          }
        : {}),
    },
    include: {
      images: true,
    },
  });
};



export const getItemsByStoreId = async (storeId: string) => {
  return prisma.item.findMany({
    where: { storeId },
    include: {
      images: true, // always include images
    },
  });
};
