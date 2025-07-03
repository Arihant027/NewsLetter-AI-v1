import { Router } from 'express';
import CuratedArticle from '../models/article.model.js';
import User from '../models/user.model.js';
import auth from '../middleware/auth.js';
import { subDays, subMonths } from 'date-fns';

const router = Router();

// MODIFIED: This route now accepts a "timeframe" query parameter to filter articles
router.get('/', auth, async (req, res) => {
    try {
        const { timeframe } = req.query; // e.g., 'day', 'week', 'month'
        const query = { savedBy: req.user };

        // If a timeframe is provided, add a date condition to the database query
        if (timeframe) {
            let startDate;
            const now = new Date();

            if (timeframe === 'day') {
                startDate = subDays(now, 1);
            } else if (timeframe === 'week') {
                startDate = subDays(now, 7);
            } else if (timeframe === 'month') {
                startDate = subMonths(now, 1);
            }

            if (startDate) {
                query.createdAt = { $gte: startDate };
            }
        }

        const savedArticles = await CuratedArticle.find(query).sort({ createdAt: -1 });
        res.json(savedArticles);
    } catch (err) { 
        res.status(500).json({ message: 'Server error while fetching articles.', error: err.message }); 
    }
});

router.post('/', auth, async (req, res) => {
    try {
        const { articles } = req.body;
        if (!articles || !Array.isArray(articles) || articles.length === 0) return res.status(400).json({ message: 'No articles provided.' });
        const admin = await User.findById(req.user);
        if (!admin) return res.status(404).json({ message: 'Admin not found.' });
        const preparedArticles = articles.map(article => ({
            ...article,
            sourceName: article.source.name,
            originalUrl: article.url,
            imageUrl: article.urlToImage,
            publishedAt: new Date(article.publishedAt),
            category: admin.categories[0] || 'General',
            savedBy: req.user
        }));
        await CuratedArticle.insertMany(preparedArticles, { ordered: false });
        res.status(201).json({ message: `${articles.length} new articles saved successfully.` });
    } catch (err) {
        if (err.code === 11000 || err.name === 'BulkWriteError') return res.status(200).json({ message: 'Articles processed. Some were already saved.' });
        res.status(500).json({ message: 'Server error saving articles.', error: err.message });
    }
});

router.delete('/:id', auth, async (req, res) => {
    try {
        const article = await CuratedArticle.findOneAndDelete({ _id: req.params.id, savedBy: req.user });

        if (!article) {
            return res.status(404).json({ message: 'Article not found or you do not have permission to delete it.' });
        }

        res.json({ message: 'Article deleted successfully.' });

    } catch (err) {
        console.error("Article Deletion Error:", err);
        res.status(500).json({ message: 'Server error while deleting article.' });
    }
});

export default router;