import { Router } from 'express';
import puppeteer from 'puppeteer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { format } from 'date-fns';
import sgMail from '@sendgrid/mail';
import Newsletter from '../models/newsletter.model.js';
import User from '../models/user.model.js';
import auth from '../middleware/auth.js';
import Notification from '../models/notification.model.js';
import Category from '../models/category.model.js';

const router = Router();

// --- Initialize SendGrid ---
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    console.log("✅ SendGrid client initialized.");
} else {
    console.warn("⚠️ SendGrid API Key not found. Email sending will be disabled.");
}

// --- Initialize Gemini AI ---
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

const createAdvancedNewsletterHtmlPrompt = (articles, title, flyerImageUrl) => {
    const articlesForPrompt = articles.map(a => ({
        title: a.title,
        summary: a.summary,
        source: a.sourceName,
        category: a.category,
        originalUrl: a.originalUrl,
        imageUrl: a.imageUrl
    }));

    return `
        Act as an expert HTML and CSS email designer. Your task is to generate a single, complete HTML file for a professional newsletter based on the provided JSON data. The design should be clean, readable, and render reliably as a PDF.

        **Design & Layout Guidelines:**

        1.  **Overall Structure:**
            * Use a main container with a max-width of 600px and center it using inline styles (margin: 20px auto;).
            * The main content area should have a white background (background-color: #ffffff;).
            * Use a consistent font family like 'Arial, sans-serif' for broad compatibility.

        2.  **Header Section:**
            * Create a clear header.
            * Prominently display the main newsletter title: "${title}" (font-size: 24px; font-weight: bold; color: #333333; padding-bottom: 10px; border-bottom: 2px solid #eeeeee; margin-bottom: 20px; text-align: center;).
            * Below the title, include the Date (${format(new Date(), 'PP')}) and "Edition 1, Volume 1" (display: block; font-size: 12px; color: #777777; text-align: center; margin-bottom: 15px;).

        3.  **Flyer Image:**
            * If a \`flyerImageUrl\` is provided, include it at the very top of the newsletter body, right after the header. The image should be responsive within the 600px container (\`max-width: 100%; height: auto; display: block; margin-bottom: 20px; border-radius: 5px;\`).

        4.  **Article Layout (Single Column):**
            * Each article should be separated by a subtle divider (border-bottom: 1px solid #eeeeee; padding-bottom: 20px; margin-bottom: 20px;). The last article should not have this bottom border.
            * If an \`imageUrl\` is provided for an article, include it at the top of the article section. The image should be responsive within the 600px container (\`max-width: 100%; height: auto; display: block; margin-bottom: 10px; border-radius: 5px;\`).
            * The article's \`title\` MUST be a clickable hyperlink pointing to its \`originalUrl\` (display: block; font-size: 18px; font-weight: bold; color: #007bff; text-decoration: none; margin-bottom: 5px;).
            * Display the \`source\` name in a smaller, muted font (display: block; font-size: 11px; color: #555555; margin-bottom: 8px;).
            * Display the \`summary\` as the main body text for the article (font-size: 14px; color: #444444; line-height: 1.5;).

        5.  **Pull Quote Section:**
            * After the first or second article, include a clearly marked "Quote:" section.
            * Use a background color (background-color: #f9f9f9; padding: 15px; border-left: 5px solid #cccccc; margin: 20px 0;).
            * For the quote, use the summary of the first article. Style it as italic (font-style: italic; color: #666666;).

        6.  **Styling (Inline CSS):**
            * **ALL CSS MUST BE APPLIED AS INLINE STYLES directly to the HTML elements.** This ensures maximum compatibility with PDF renderers. Do not use <style> tags or external stylesheets.
            * Focus on basic styles like font-size, color, background-color, margin, padding, border, text-decoration, display, and text-align.

        **JSON Data to Use:**
        \`\`\`json
        ${JSON.stringify({ articles: articlesForPrompt, flyerImageUrl }, null, 2)}
        \`\`\`

        **IMPORTANT: Your response MUST be only the raw HTML code, starting with <!DOCTYPE html> and containing all the specified elements with INLINE STYLES. Do not add any commentary, explanations, or markdown formatting before or after the code block.**
    `;
};


// GET all newsletters for the logged-in admin's categories
router.get('/', auth, async (req, res) => {
  try {
    const admin = await User.findById(req.user);
    if (!admin || !admin.categories || admin.categories.length === 0) {
        return res.json([]);
    }
    const newsletters = await Newsletter.find({ category: { $in: admin.categories } });
    res.json(newsletters);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching newsletters.' });
  }
});


// POST to generate, save, and send the new PDF
router.post('/generate-and-save', auth, async (req, res) => {
    if (!genAI) {
        return res.status(500).json({ message: 'Gemini API client is not initialized.' });
    }
    
    try {
        const { articles, title, category } = req.body;
        console.log(`[PDF LOG] Received request for newsletter: "${title}"`);

        if (!articles || articles.length === 0 || !title || !category) {
            return res.status(400).json({ message: 'Title, category, and articles are required.' });
        }

        const categoryData = await Category.findOne({ name: category });
        const flyerImageUrl = categoryData ? categoryData.flyerImageUrl : null;

        // 1. Generate HTML with AI using the new advanced prompt
        console.log("[PDF LOG] Generating HTML with advanced prompt...");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const prompt = createAdvancedNewsletterHtmlPrompt(articles, title, flyerImageUrl);
        
        const result = await model.generateContent(prompt);
        let generatedHtml = result.response.text().replace(/^```html\n/, '').replace(/\n```$/, '');

        if (!generatedHtml || generatedHtml.length < 100) {
            throw new Error('AI returned an empty or invalid HTML response.');
        }
        console.log("[PDF LOG] Successfully received HTML from AI.");

        // 2. Convert HTML to PDF
        const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(generatedHtml, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();
        console.log("[PDF LOG] Successfully converted HTML to PDF buffer.");

        // 3. Create and Save New Newsletter to DB
        const newNewsletter = new Newsletter({
            title,
            category,
            articles: articles.map(a => a._id),
            status: 'Not Sent',
            pdfContent: {
                data: Buffer.from(pdfBuffer),
                contentType: 'application/pdf'
            },
            htmlContent: generatedHtml
        });
        await newNewsletter.save();
        console.log(`[PDF LOG] Successfully saved newsletter with ID: ${newNewsletter._id}`);
        
        const notification = new Notification({
            user: req.user,
            newsletter: newNewsletter._id,
            message: `New newsletter "${newNewsletter.title}" generated. Check it out in "Newsletter History" to share and view.`,
            actionUrl: '/dashboard?tab=generated-newsletters'
        });
        await notification.save();
        
        // 4. Send the generated PDF back to the client
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${title.replace(/\s/g, '_')}.pdf"`);
        res.send(pdfBuffer);

    } catch (err) {
        console.error("--- PDF GENERATION/SAVE FAILED ---", err);
        res.status(500).json({ message: 'Failed to generate and save PDF. Check server logs for details.' });
    }
});

// GET to download a saved PDF
router.get('/:id/download', auth, async (req, res) => {
    try {
        const newsletter = await Newsletter.findById(req.params.id);
        if (!newsletter || !newsletter.pdfContent || !newsletter.pdfContent.data) {
            return res.status(404).send('PDF not found.');
        }
        res.setHeader('Content-Type', newsletter.pdfContent.contentType);
        res.setHeader('Content-Disposition', `inline; filename="${newsletter.title.replace(/\s/g, '_')}.pdf"`);
        res.send(newsletter.pdfContent.data);
    } catch (err) {
        res.status(500).send('Server error while retrieving PDF.');
    }
});

// PATCH to update a newsletter's status
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const updatedNewsletter = await Newsletter.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json(updatedNewsletter);
  } catch (err) {
    res.status(500).json({ message: 'Server error updating status.' });
  }
});

// DELETE a newsletter
router.delete('/:id', auth, async (req, res) => {
  try {
    const newsletter = await Newsletter.findByIdAndDelete(req.params.id);
    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found.' });
    }
    res.json({ message: 'Newsletter deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error while deleting newsletter.' });
  }
});

// POST to send the newsletter to users
router.post('/:id/send', auth, async (req, res) => {
    try {
        const { userIds } = req.body;
        if (!userIds || userIds.length === 0) {
            return res.status(400).json({ message: 'No recipients selected.' });
        }
        const newsletter = await Newsletter.findById(req.params.id);
        if (!newsletter) {
            return res.status(404).json({ message: 'Newsletter not found.' });
        }
        if (process.env.SENDGRID_API_KEY) {
            const recipients = await User.find({ '_id': { $in: userIds } }).select('email');
            if (recipients.length > 0) {
                 const msg = {
                    to: recipients.map(r => r.email),
                    from: { name: 'NewsLetterAI', email: process.env.FROM_EMAIL },
                    subject: `Your Newsletter: ${newsletter.title}`,
                    html: newsletter.htmlContent,
                };
                await sgMail.send(msg);
            }
        }
        newsletter.status = 'sent';
        newsletter.recipients.addToSet(...userIds);
        await newsletter.save();
        
        try {
            const notifications = userIds.map(userId => ({
                user: userId,
                newsletter: newsletter._id,
                message: `You received the "${newsletter.title}" newsletter.`,
            }));
            if (notifications.length > 0) {
                await Notification.insertMany(notifications, { ordered: false });
            }
        } catch (notificationError) {
            console.error('CRITICAL: Failed to create notifications, but email was sent.', notificationError);
        }
        res.json({ message: `Newsletter successfully sent to ${userIds.length} user(s).` });
    } catch (err) {
        console.error('A major error occurred in the /send route:', err);
        res.status(500).json({ message: 'Failed to send newsletter due to a server error.' });
    }
});

export default router;