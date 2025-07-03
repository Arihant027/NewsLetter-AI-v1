import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

const router = Router();

// --- Signup Route ---
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, userType } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please enter all required fields.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      email,
      password: passwordHash,
      userType,
      categories: [], // Categories are assigned by admins/superadmins post-signup
    });

    const savedUser = await newUser.save();
    res.status(201).json(savedUser);

  } catch (err) {
    res.status(500).json({ message: 'Server error during signup.', error: err.message });
  }
});

// --- Login Route (Improved) ---
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find user by email, regardless of their role
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'No Account Found!' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        user.lastLogin = Date.now();
        await user.save();

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
        
        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                userType: user.userType,
            },
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error during login.', error: err.message });
    }
});


export default router;