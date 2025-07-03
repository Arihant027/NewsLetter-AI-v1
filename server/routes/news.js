import { Router } from 'express';
import User from '../models/user.model.js';
import auth from '../middleware/auth.js';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { format, subDays } from 'date-fns';

const router = Router();

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// A map to create more specific, relevant search queries for NewsAPI.org
const keywordMap = {
    'java': `("Java" AND (framework OR library OR performance OR Spring OR Quarkus)) NOT (coffee OR island)`,
    'information security': `(cybersecurity OR "data breach" OR vulnerability OR phishing OR malware) NOT (job OR hiring)`,
    'data science': `("machine learning" OR "artificial intelligence" OR Pandas OR NumPy OR TensorFlow) NOT (course OR bootcamp)`,
    'devops': `(DevOps OR "CI/CD" OR Docker OR Kubernetes) AND (automation OR cloud OR infrastructure)`,
};

// GET /api/news - Fetch relevant news from NewsAPI.org
router.get('/', auth, async (req, res) => {
    try {
        const admin = await User.findById(req.user);
        if (!admin || !admin.categories || admin.categories.length === 0) {
            return res.json({ articles: [] });
        }
        
        // Map the admin's categories to the more specific queries from the keywordMap.
        // If a category is not in the map, it will be wrapped in quotes for an exact match.
        const specificQueries = admin.categories.map(cat => keywordMap[cat.toLowerCase()] || `"${cat}"`);
        
        // Join the specific queries with 'OR' to search for any of them.
        const query = specificQueries.join(' OR ');

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