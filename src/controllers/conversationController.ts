import { Request, Response } from "express";
import { getAuth } from "@clerk/express";
import * as conversationService from "../services/conversationService";
import { prisma } from "../lib/prisma";
import { sendGuestAccessEmail } from "../lib/email";

export const getConversations = async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const data = await conversationService.getConversations(userId);

    res.json(data);
  } catch (error) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getConversationMessages = async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!id) {
      return res.status(400).json({ error: "Conversation ID is required" });
    }

    const data = await conversationService.getConversationMessages(
      userId,
      id
    );

    res.json(data);
  } catch (error) {
    console.error("Error fetching conversation messages:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const markConversationRead = async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!id) {
      return res.status(400).json({ error: "Conversation ID is required" });
    }

    await conversationService.markConversationRead(userId, id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking conversation read:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const count = await conversationService.getUnreadCount(userId);
    res.json({ count });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const markAllRead = async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await conversationService.markAllRead(userId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking all read:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const createMessage = async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    const { content, conversationId, recipientUserId, guest } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Message content is required" });
    }

    let senderUserId: string | undefined = undefined;
    let senderGuest: { email: string; name?: string } | null = null;

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { clerkUserId: userId },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      senderUserId = user.id;
    } else {
      if (!guest?.email) {
        return res.status(400).json({ error: "Guest email is required" });
      }
      senderGuest = { email: guest.email, name: guest.name };
    }

    if (!conversationId && !recipientUserId) {
      return res.status(400).json({ error: "Recipient user ID is required" });
    }

    const result = await conversationService.createMessage({
      content,
      conversationId,
      recipientUserId,
      senderUserId,
      senderGuest,
    });

    // Message notifications are handled via inbox unread counts (not system notifications).

    if (senderGuest && result.guestAccessToken) {
      try {
        let storeName = "the store";
        if (recipientUserId) {
          const recipient = await prisma.user.findUnique({
            where: { id: recipientUserId },
            select: { name: true, email: true },
          });
          storeName = recipient?.name || recipient?.email || storeName;
        }

        const origin =
          process.env.FRONTEND_URL ||
          req.headers.origin ||
          "http://localhost:3001";
        const accessUrl = `${origin}/guest-inbox?token=${result.guestAccessToken}`;
        await sendGuestAccessEmail({
          to: senderGuest.email,
          storeName,
          accessUrl,
        });
      } catch (emailError) {
        console.error("Failed to send guest access email:", emailError);
      }
    }

    res.json(result);
  } catch (error) {
    console.error("Error creating message:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getGuestConversation = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: "Access token is required" });
    }

    const data = await conversationService.getGuestConversationByToken(token);
    res.json(data);
  } catch (error) {
    console.error("Error fetching guest conversation:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const createGuestMessage = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { content } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Access token is required" });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Message content is required" });
    }

    const data = await conversationService.createGuestMessageByToken(
      token,
      content
    );
    res.json(data);
  } catch (error) {
    console.error("Error creating guest message:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
