import 'dotenv/config';
import express from 'express';
import { prisma } from '../lib/prisma';
import { clerkMiddleware, requireAuth } from '@clerk/express';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors()); // Add CORS for frontend requests
app.use(clerkMiddleware());

app.get('/', async (req, res) => {
  res.json("Services API");
});

app.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// New endpoint to sync user from Clerk to your database
app.post('/api/users/sync', async (req, res) => {
  try {
    const { clerkUserId, email, name } = req.body;

    if (!clerkUserId || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (existingUser) {
      return res.json(existingUser);
    }

    // Create new user in your database
    const user = await prisma.user.create({
      data: {
        clerkUserId,
        email,
        name,
      },
    });

    res.json(user);
  } catch (error) {
    console.error('Error syncing user:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});