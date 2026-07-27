const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { authenticateToken, adminOnly } = require('../middleware/authMiddleware');
const { Op } = require('sequelize');

// GET all users (Admin only) with pagination and search
router.get('/', authenticateToken, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = search ? {
      [Op.or]: [
        { en: { [Op.like]: `%${search}%` } },
        { role: { [Op.like]: `%${search}%` } },
        { plant: { [Op.like]: `%${search}%` } },
      ],
    } : {};

    const { count, rows } = await User.findAndCountAll({
      where: whereClause,
      attributes: ['id', 'en', 'role', 'plant', 'createdAt', 'updatedAt'], // ไม่ส่งรหัสผ่านกลับไป
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      order: [['createdAt', 'DESC']],
    });

    res.json({
      users: rows,
      totalUsers: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page, 10),
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// PUT update a user's plant (Admin only)
router.put('/:id', authenticateToken, adminOnly, async (req, res) => {
  try {
    const userId = req.params.id;
    const { plant } = req.body;

    if (typeof plant !== 'string' || plant.trim() === '') {
      return res.status(400).json({ message: 'Plant name is required and must be a string.' });
    }

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.plant = plant.trim();
    await user.save();

    res.status(200).json({ message: 'User plant updated successfully', user: user.toJSON() });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Failed to update user' });
  }
});

// DELETE a user (Admin only)
router.delete('/:id', authenticateToken, adminOnly, async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // ป้องกันไม่ให้ admin ลบบัญชีตัวเอง
    if (user.id === req.user.id) {
        return res.status(400).json({ message: 'Cannot delete your own account.' });
    }

    await user.destroy();
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

module.exports = router;