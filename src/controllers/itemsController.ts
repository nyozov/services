import { Request, Response } from 'express';
import { getAuth } from '@clerk/express';
import * as itemService from '../services/itemService';

export const createItem = async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);

    const {
      storeId,
      name,
      description,
      price,
      images,
    } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!storeId || !name || price === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Verify user owns the store
    const hasAccess = await itemService.verifyStoreAccess(userId, storeId);
    if (!hasAccess) {
      return res
        .status(403)
        .json({ error: "You do not have access to this store" });
    }

    const item = await itemService.createItem({
      storeId,
      name,
      description,
      price,
      images: Array.isArray(images)
        ? images.map((img: any, index: number) => ({
            url: img.url,
            publicId: img.publicId,
            position: index,
          }))
        : [],
    });

    res.json(item);
  } catch (error) {
    console.error("Error creating item:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};


export const getStoreItems = async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    const { storeId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!storeId) {
      return res.status(400).json({ error: 'Store ID is required' });
    }

    // Verify user owns the store
    const hasAccess = await itemService.verifyStoreAccess(userId, storeId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this store' });
    }

    // Fetch items including images
    const items = await itemService.getItemsByStoreId(storeId);

    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};
