import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { clerkMiddleware } from '@clerk/express';
import routes from './routes';
import "./lib/redis";

const app = express();

// Middleware
app.use(cors());


// IMPORTANT: Stripe webhook needs raw body
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(clerkMiddleware());
app.use(express.json()); // This comes AFTER webhook route

// Routes
app.use('/api', routes);

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
