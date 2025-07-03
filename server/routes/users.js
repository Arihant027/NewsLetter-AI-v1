import { Router } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import auth from '../middleware/auth.js';
import User from '../models/user.model.js';
import Newsletter from '../models/newsletter.model.js';
import Notification from '../models/notification.model.js';
import sgMail from '@sendgrid/mail';
import jwt from 'jsonwebtoken';

const router = Router();

// GET Logged-in User's Data
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user).select('-password');
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH - Update User Profile (Email, Name, Password)
router.patch('/me/profile', auth, async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const user = await User.findById(req.user);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (email && email !== user.email) {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ message: 'This email is already in use.' });
            }
            user.email = email;
        }

        if (name) {
            user.name = name;
        }

        if (password) {
            const salt = await bcrypt.genSalt();
            user.password = await bcrypt.hash(password, salt);
        }

        const updatedUser = await user.save();
        
        // Re-issue token with potentially new email
        const token = jwt.sign({ id: updatedUser._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.json({
            token,
            user: {
                id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                userType: updatedUser.userType,
                categories: updatedUser.categories
            },
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error updating profile.', error: err.message });
    }
});

// PATCH - Update User's Category Preferences
router.patch('/me/categories', auth, async (req, res) => {
    try {
        const { categories } = req.body;
        const updatedUser = await User.findByIdAndUpdate(
            req.user,
            { categories: categories },
            { new: true }
        ).select('-password');
        res.json(updatedUser);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET user's received newsletters
router.get('/my-newsletters', auth, async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user);

        const receivedNewsletters = await Newsletter.find({ recipients: userId })
            .sort({ createdAt: -1 })
            .select('title category createdAt');

        res.json(receivedNewsletters);
    } catch (err) {
        console.error("Error fetching user newsletters:", err);
        res.status(500).json({ error: 'Server error while fetching newsletters.' });
    }
});


// ENDPOINT TO EMAIL A NEWSLETTER TO THE LOGGED-IN USER
router.post('/send-newsletter-to-self', auth, async (req, res) => {
    if (!process.env.SENDGRID_API_KEY || !process.env.FROM_EMAIL) {
        return res.status(500).json({ message: 'Email service is not configured on the server.' });
    }
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    try {
        const { newsletterId } = req.body;
        if (!newsletterId) {
            return res.status(400).json({ message: 'Newsletter ID is required.' });
        }

        const user = await User.findById(req.user).select('name email');
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const newsletter = await Newsletter.findById(newsletterId);
        if (!newsletter || !newsletter.pdfContent || !newsletter.pdfContent.data) {
            return res.status(404).json({ message: 'Newsletter or its PDF content not found.' });
        }

        const msg = {
            to: user.email,
            from: { name: 'NewsLetterAI', email: process.env.FROM_EMAIL },
            subject: `Your Requested Newsletter: ${newsletter.title}`,
            html: `<p>Hi ${user.name || ''},</p><p>As requested, the newsletter "<strong>${newsletter.title}</strong>" is attached to this email.</p>`,
            attachments: [{
                content: newsletter.pdfContent.data.toString('base64'),
                filename: `${newsletter.title.replace(/\s/g, '_')}.pdf`,
                type: 'application/pdf',
                disposition: 'attachment',
            }],
        };
        
        await sgMail.send(msg);

        newsletter.recipients.addToSet(user._id);
        await newsletter.save();
        
        const newNotification = new Notification({
            user: user._id,
            newsletter: newsletter._id,
            message: `You sent the "${newsletter.title}" newsletter to your email.`,
        });
        await newNotification.save();

        res.json({ message: `Newsletter successfully sent to ${user.email}.` });

    } catch (err) {
        console.error('Error sending newsletter to self:', err);
        if (err.response) {
            console.error(err.response.body);
        }
        res.status(500).json({ message: 'Failed to send email due to a server error.' });
    }
});

export default router;