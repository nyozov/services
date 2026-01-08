import 'dotenv/config';
import express from 'express';
import { prisma } from '../lib/prisma';

const app = express();
app.use(express.json());

app.get('/', async (req, res) => {
  res.json("Services API")
})

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});