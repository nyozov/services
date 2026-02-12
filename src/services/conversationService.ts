import { prisma } from "../lib/prisma";
import crypto from "crypto";

type CreateMessageData = {
  content: string;
  conversationId?: string;

  senderUserId?: string;
  senderGuest?: GuestInput | null;

  recipientUserId?: string;
};

type GuestInput = {
  email: string;
  name?: string;
};

async function getOrCreateGuestAccessToken(guestId: string, conversationId: string) {
  const existing = await prisma.guestAccessToken.findFirst({
    where: { guestId, conversationId },
  });

  if (existing) {
    return existing;
  }

  return prisma.guestAccessToken.create({
    data: {
      guestId,
      conversationId,
      token: crypto.randomBytes(24).toString("hex"),
    },
  });
}

async function createConversation({
  senderUserId,
  senderGuest,
  recipientUserId,
}: {
  senderUserId?: string | undefined;
  senderGuest?: GuestInput | null | undefined;
  recipientUserId: string;
}) {
  const conversation = await prisma.conversation.create({
    data: {
      participants: {
        create: [
          { userId: recipientUserId },
          ...(senderUserId ? [{ userId: senderUserId }] : []),
        ],
      },
    },
  });

  return conversation.id;
}

export const getConversations = async (clerkUserId: string) => {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
  });

  if (!user) {
    return [];
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      participants: {
        some: {
          userId: user.id,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    include: {
      participants: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          senderUser: { select: { id: true, name: true, email: true } },
          senderGuest: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  return { viewerUserId: user.id, conversations };
};

export const getConversationMessages = async (
  clerkUserId: string,
  conversationId: string
) => {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const participant = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId,
      userId: user.id,
    },
  });

  if (!participant) {
    throw new Error("Unauthorized");
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          senderUser: { select: { id: true, name: true, email: true } },
          senderGuest: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  return { viewerUserId: user.id, conversation };
};

export const markConversationRead = async (
  clerkUserId: string,
  conversationId: string
) => {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const participant = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId,
      userId: user.id,
    },
  });

  if (!participant) {
    throw new Error("Unauthorized");
  }

  await prisma.conversationParticipant.update({
    where: { id: participant.id },
    data: { lastReadAt: new Date() },
  });

  return true;
};

export const getUnreadCount = async (clerkUserId: string) => {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
  });

  if (!user) {
    return 0;
  }

  const participants = await prisma.conversationParticipant.findMany({
    where: { userId: user.id },
    select: { conversationId: true, lastReadAt: true },
  });

  let count = 0;

  for (const participant of participants) {
    const createdAtFilter = participant.lastReadAt
      ? { gt: participant.lastReadAt }
      : undefined;

    const unread = await prisma.message.count({
      where: {
        conversationId: participant.conversationId,
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
        OR: [
          { senderGuestId: { not: null } },
          { senderUserId: { not: user.id } },
        ],
      },
    });

    count += unread;
  }

  return count;
};

export const markAllRead = async (clerkUserId: string) => {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  await prisma.conversationParticipant.updateMany({
    where: { userId: user.id },
    data: { lastReadAt: new Date() },
  });

  return true;
};

export async function createMessage(input: CreateMessageData) {
  const {
    content,
    conversationId,
    senderUserId,
    senderGuest,
    recipientUserId,
  } = input;

  if (!content.trim()) {
    throw new Error("Message content is required");
  }

  if (!!senderUserId === !!senderGuest) {
    throw new Error("Exactly one sender type must be provided");
  }

  let conversationIdToUse = conversationId;

  if (!conversationIdToUse) {
    if (!recipientUserId) {
      throw new Error("Recipient is required");
    }
    conversationIdToUse = await createConversation({
      senderUserId: senderUserId ?? undefined,
      senderGuest: senderGuest ?? undefined,
      recipientUserId,
    });
  }

  if (!conversationIdToUse) {
    throw new Error("Failed to resolve conversation");
  }

  const senderData: {
    senderUserId?: string;
    senderGuestId?: string;
  } = {};

  if (senderUserId) {
    senderData.senderUserId = senderUserId;
  }

  const guestInput = senderGuest;

  if (guestInput) {
    const guest = await prisma.guest.upsert({
      where: { email: guestInput.email },
      update: {},
      create: {
        email: guestInput.email,
        name: guestInput.name ?? null,
      },
    });

    senderData.senderGuestId = guest.id;
  }

  const message = await prisma.message.create({
    data: {
      content,
      conversationId: conversationIdToUse,
      ...senderData,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationIdToUse },
    data: { updatedAt: new Date() },
  });

  let guestAccessToken: string | null = null;

  if (senderData.senderGuestId) {
    const token = await getOrCreateGuestAccessToken(
      senderData.senderGuestId,
      conversationIdToUse
    );
    guestAccessToken = token.token;
  }

  return { message, guestAccessToken, conversationId: conversationIdToUse };
}

export const getGuestConversationByToken = async (token: string) => {
  const access = await prisma.guestAccessToken.findUnique({
    where: { token },
  });

  if (!access) {
    throw new Error("Invalid access token");
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: access.conversationId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          senderUser: { select: { id: true, name: true, email: true } },
          senderGuest: { select: { id: true, name: true, email: true } },
        },
      },
      participants: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  return { conversation, guestId: access.guestId };
};

export const createGuestMessageByToken = async (token: string, content: string) => {
  const access = await prisma.guestAccessToken.findUnique({
    where: { token },
    include: { guest: true },
  });

  if (!access) {
    throw new Error("Invalid access token");
  }

  return createMessage({
    content,
    conversationId: access.conversationId,
    senderGuest: {
      email: access.guest.email,
      name: access.guest.name ?? undefined,
    },
  });
};
