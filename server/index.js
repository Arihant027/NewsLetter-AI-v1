import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import 'dotenv/config';
import auth from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admins.js';
import categoryRoutes from './routes/categories.js';
import newsletterRoutes from './routes/newsletters.js';
import userRoutes from './routes/users.js';
import newsRoutes from './routes/news.js';
import articleRoutes from './routes/articles.js';
import notificationRoutes from './routes/notifications.js';

const app = express();
const port = process.env.PORT || 5000;

// This permissive CORS policy allows all origins, which is fine for development.
app.use(cors());

app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connection established."))
  .catch(err => { console.error("❌ MongoDB connection failed.", err); process.exit(1); });

app.use('/api/auth', authRoutes);
app.use('/api/admins', auth, adminRoutes);
app.use('/api/categories', auth, categoryRoutes);
app.use('/api/newsletters', auth, newsletterRoutes);
app.use('/api/users', auth, userRoutes);
app.use('/api/news', auth, newsRoutes);
app.use('/api/articles', auth, articleRoutes);
app.use('/api/notifications', auth, notificationRoutes);

app.listen(port, () => {
  console.log(`🚀 Server is running on port: ${port}`);
});