import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { clerkMiddleware } from '@clerk/express';
import routes from './routes';

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(clerkMiddleware());

// Routes
app.use('/api', routes);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});