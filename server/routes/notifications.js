import { Router } from 'express';
import auth from '../middleware/auth.js';
import Notification from '../models/notification.model.js';

const router = Router();

// GET all recent notifications for the logged-in user
router.get('/', auth, async (req, res) => {
    try {
        const notifications = await Notification.find({ user: req.user })
            .sort({ createdAt: -1 })
            .limit(10); 
        res.json(notifications);
    } catch (err) {
        res.status(500).json({ message: 'Server error fetching notifications.' });
    }
});

// POST - Mark all notifications as read for the logged-in user
router.post('/mark-as-read', auth, async (req, res) => {
    try {
        await Notification.updateMany({ user: req.user, isRead: false }, { $set: { isRead: true } });
        res.json({ message: 'Notifications marked as read.' });
    } catch (err) {
        res.status(500).json({ message: 'Server error updating notifications.' });
    }
});

// NEW: DELETE a specific notification
router.delete('/:id', auth, async (req, res) => {
    try {
        const notification = await Notification.findOne({
            _id: req.params.id,
            user: req.user // Ensure the user can only delete their own notifications
        });

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found or access denied.' });
        }

        await Notification.findByIdAndDelete(req.params.id);

        res.json({ message: 'Notification deleted.' });
    } catch (err) {
        res.status(500).json({ message: 'Server error deleting notification.' });
    }
});

export default router;