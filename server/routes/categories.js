import { Router } from 'express';
import Category from '../models/category.model.js';
import User from '../models/user.model.js';
import auth from '../middleware/auth.js';

const router = Router();

// GET all categories
router.get('/', auth, async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching categories.' });
  }
});

// POST - Add a new category
router.post('/', auth, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: 'Category name is required.' });
        const newCategory = new Category({ name });
        await newCategory.save();
        res.status(201).json(newCategory);
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ message: 'A category with this name already exists.' });
        res.status(500).json({ message: 'Server error creating category.' });
    }
});

// DELETE a category
router.delete('/:id', auth, async (req, res) => {
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