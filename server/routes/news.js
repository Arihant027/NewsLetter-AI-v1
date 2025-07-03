import { Router } from 'express';
import User from '../models/user.model.js';
import auth from '../middleware/auth.js';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { format, subDays } from 'date-fns';
import Category from '../models/category.model.js';

const router = Router();

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// GET /api/news - Fetch relevant news from NewsAPI.org
router.get('/', auth, async (req, res) => {
    try {
        const admin = await User.findById(req.user);
        if (!admin || !admin.categories || admin.categories.length === 0) {
            return res.json({ articles: [] });
        }

        const categories = await Category.find({ name: { $in: admin.categories } });
        const allKeywords = categories.flatMap(cat => cat.keywords && cat.keywords.length > 0 ? cat.keywords : `"${cat.name}"`);

        const query = allKeywords.join(' OR ');

        const fromDate = format(subDays(new Date(), 7), 'yyyy-MM-dd');

        const newsApiResponse = await axios.get('https://newsapi.org/v2/everything', {
            params: {
                q: query,
                from: fromDate,
                sortBy: 'relevancy', // Sorting by relevancy for better results with specific queries
                language: 'en',
                apiKey: process.env.NEWS_API_KEY,
            }
        });

        res.json({ articles: newsApiResponse.data.articles });

    } catch (err) {
        if (err.response) {
            console.error('NewsAPI Error:', err.response.data);
            return res.status(500).json({ message: `Failed to fetch news: ${err.response.data.message}` });
        }
        res.status(500).json({ message: 'Failed to fetch news from NewsAPI.org.', error: err.message });
    }
});

// POST /api/news/summarize - Summarize article text using Gemini
router.post('/summarize', auth, async (req, res) => {
    if (!genAI) {
        return res.status(500).json({ message: 'Gemini API client is not initialized. Please check your API key.' });
    }
    try {
        const { textToSummarize } = req.body;
        if (!textToSummarize) return res.status(400).json({ message: 'No text provided to summarize.' });

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        
        const prompt = `
            Generate a professional, newsletter-style summary of the following text.

            The summary must be:
            - Approximately 2-3 paragraphs long.
            - Engaging and informative for a professional audience.
            - It must capture the main topic, key findings, and important conclusions.
            - The tone should be objective and clear.
            - Do not start with conversational phrases.

            TEXT:
            """
            ${textToSummarize}
            """

            SUMMARY:
        `;
        
        const result = await model.generateContent(prompt);
        const summary = result.response.text();
        res.json({ summary });
    } catch (err) {
        res.status(500).json({ message: 'Failed to generate summary.', error: err.message });
    }
});

export default router;