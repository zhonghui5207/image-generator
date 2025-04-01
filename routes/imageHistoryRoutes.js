import express from 'express';
import GeneratedImage from '../models/GeneratedImage.js';
import { authenticate } from '../utils/auth.js';

const router = express.Router();

// 获取用户的图像生成历史
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const images = await GeneratedImage.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await GeneratedImage.countDocuments({ user: req.user._id });
    
    res.json({
      success: true,
      images,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取图像历史错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取单个图像详情
router.get('/:id', authenticate, async (req, res) => {
  try {
    const image = await GeneratedImage.findOne({
      _id: req.params.id,
      user: req.user._id
    });
    
    if (!image) {
      return res.status(404).json({ success: false, message: '图像不存在' });
    }
    
    res.json({
      success: true,
      image
    });
  } catch (error) {
    console.error('获取图像详情错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 删除图像历史记录
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const image = await GeneratedImage.findOne({
      _id: req.params.id,
      user: req.user._id
    });
    
    if (!image) {
      return res.status(404).json({ success: false, message: '图像不存在' });
    }
    
    await image.remove();
    
    res.json({
      success: true,
      message: '图像历史记录已删除'
    });
  } catch (error) {
    console.error('删除图像历史错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

export default router;
