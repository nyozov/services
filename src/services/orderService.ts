import { prisma } from '../lib/prisma';

export const getOrdersByClerkUserId = async (clerkUserId: string) => {
  // Find user
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    include: {
      stores: {
        include: {
          items: {
            include: {
              orders: {
                include: {
                  item: {
                    include: {
                      store: true,
                    },
                  },
                },
                orderBy: {
                  createdAt: 'desc',
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    return [];
  }

  // Flatten all orders from all stores
  const orders = user.stores.flatMap((store) =>
    store.items.flatMap((item) => item.orders)
  );

  return orders;
};