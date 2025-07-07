import { Router } from 'express';
import Category from '../models/category.model.js';
import User from '../models/user.model.js';
import auth from '../middleware/auth.js';

const router = Router();

// Middleware to check for admin or superadmin role
const isAdminOrSuperAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.user);
        if (!user || (user.userType !== 'admin' && user.userType !== 'superadmin')) {
            return res.status(403).json({ message: 'Access denied. Admin permission required.' });
        }
        req.userRef = user; // Pass the user object to the next middleware/handler
        next();
    } catch (err) {
        res.status(500).json({ message: 'Server error during role check.' });
    }
};

// GET all categories (accessible to all authenticated users)
router.get('/', auth, async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching categories.' });
  }
});

// POST - Add a new category (Superadmins only)
router.post('/', auth, isAdminOrSuperAdmin, async (req, res) => {
    if (req.userRef.userType !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied. Superadmin permission required.' });
    }
    try {
        const { name, keywords, flyerImageUrl } = req.body;
        if (!name) return res.status(400).json({ message: 'Category name is required.' });
        const newCategory = new Category({ name, keywords, flyerImageUrl });
        await newCategory.save();
        res.status(201).json(newCategory);
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ message: 'A category with this name already exists.' });
        res.status(500).json({ message: 'Server error creating category.' });
    }
});

// PATCH - Update a category (Admins and Superadmins)
router.patch('/:id', auth, isAdminOrSuperAdmin, async (req, res) => {
    try {
        const { name, keywords, flyerImageUrl } = req.body;
        const category = await Category.findById(req.params.id);

        if (!category) {
            return res.status(404).json({ message: 'Category not found.' });
        }

        // If the user is an admin (not superadmin), check if they manage this category
        if (req.userRef.userType === 'admin') {
            if (!req.userRef.categories.includes(category.name)) {
                return res.status(403).json({ message: 'You are not authorized to edit this category.' });
            }
        }

        const updatedCategory = await Category.findByIdAndUpdate(
            req.params.id,
            { name, keywords, flyerImageUrl },
            { new: true }
        );

        res.json(updatedCategory);
    } catch (err) {
        res.status(500).json({ message: 'Server error updating category.', error: err.message });
    }
});


// DELETE a category (Superadmins only)
router.delete('/:id', auth, isAdminOrSuperAdmin, async (req, res) => {
    if (req.userRef.userType !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied. Superadmin permission required.' });
    }
    try {
        const categoryToDelete = await Category.findById(req.params.id);
        if (!categoryToDelete) return res.status(404).json({ message: 'Category not found.' });

        await User.updateMany(
            { _id: { $in: categoryToDelete.admins } },
            { $pull: { categories: categoryToDelete.name } }
        );

        await Category.findByIdAndDelete(req.params.id);
        res.json({ message: 'Category removed successfully.' });
    } catch (err) {
        res.status(500).json({ message: 'Server error while removing category.', error: err.message });
    }
});


export default router;