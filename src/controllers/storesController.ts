import { Request, Response } from "express";
import { getAuth } from "@clerk/express";
import * as storeService from "../services/storeService";
import * as itemService from "../services/itemService";

export const createStore = async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    const { name, description } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!name) {
      return res.status(400).json({ error: "Store name is required" });
    }

    const store = await storeService.createStore(userId, { name, description });
    res.json(store);
  } catch (error) {
    console.error("Error creating store:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getUserStores = async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const stores = await storeService.getStoresByClerkUserId(userId);
    res.json(stores);
  } catch (error) {
    console.error("Error fetching stores:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getStoreBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    if (!slug) {
      return res.status(400).json({ error: "Slug is required" });
    }

    const store = await storeService.getStoreBySlug(slug);

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    res.json(store);
  } catch (error) {
    console.error("Error fetching store:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getStoreItems = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    if (!slug) {
      return res.status(400).json({ error: "Slug is required" });
    }

    const store = await storeService.getStoreBySlug(slug);

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const items = await itemService.getPublicItemsByStoreId(store.id);
    res.json(items);
  } catch (error) {
    console.error("Error fetching store items:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const trackView = async (req: Request, res: Response) => {
  try {
    await storeService.trackView(req);
    res.sendStatus(200);
  } catch (err) {
    console.error("trackView error", err);
    res.sendStatus(200); // never break page load
  }
};
