import { jest } from '@jest/globals';

jest.unstable_mockModule('@clerk/express', () => ({
  requireAuth: () => (req: any, _res: any, next: any) => {
    req.auth = { userId: 'user_1' };
    next();
  },
  getAuth: () => ({ userId: 'user_1' }),
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
}));

const prismaMock = {
  order: {
    findUnique: jest.fn(),
  },
};
jest.unstable_mockModule('../lib/prisma', () => ({
  prisma: prismaMock,
}));

const refundOrder = jest.fn();
jest.unstable_mockModule('../services/stripeService', () => ({
  refundOrder,
}));

jest.unstable_mockModule('../lib/redis', () => ({
  redis: {},
}));

const { default: app } = await import('../index');
const request = (await import('supertest')).default;

describe('POST /api/stripe/refund', () => {
  beforeEach(() => {
    prismaMock.order.findUnique.mockReset();
    refundOrder.mockReset();
  });

  it('refunds an order for the store owner', async () => {
    prismaMock.order.findUnique.mockImplementation(async () => ({
      id: 'order_1',
      item: {
        store: {
          user: {
            clerkUserId: 'user_1',
          },
        },
      },
    }));

    refundOrder.mockImplementation(async () => ({
      refund: { id: 're_1' },
      order: { id: 'order_1', status: 'refunded' },
    }));

    const res = await request(app)
      .post('/api/stripe/refund')
      .send({ orderId: 'order_1' });

    expect(res.status).toBe(200);
    expect(refundOrder).toHaveBeenCalledWith({
      orderId: 'order_1',
      amount: undefined,
      refundPlatformFee: undefined,
    });
    expect(res.body.order?.status).toBe('refunded');
  });
});
