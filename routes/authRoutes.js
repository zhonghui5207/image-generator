import express from 'express';
import User from '../models/User.js';
import { generateToken, authenticate } from '../utils/auth.js';

const router = express.Router();

// 注册新用户
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // 检查用户是否已存在
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ 
        success: false, 
        message: '用户名或邮箱已被注册' 
      });
    }
    
    // 创建新用户
    const user = await User.create({
      username,
      email,
      password
    });
    
    // 生成JWT令牌
    const token = generateToken(user._id);
    
    // 设置cookie
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30天
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    
    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        credits: user.credits,
        isAdmin: user.isAdmin,
        phoneVerified: user.phoneVerified,
        needPhoneVerification: true
      }
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 用户登录
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // 查找用户
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: '邮箱或密码不正确' });
    }
    
    // 验证密码
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: '邮箱或密码不正确' });
    }
    
    // 更新最后登录时间
    user.lastLogin = Date.now();
    await user.save();
    
    // 生成JWT令牌
    const token = generateToken(user._id);
    
    // 设置cookie
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30天
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    
    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        credits: user.credits,
        isAdmin: user.isAdmin,
        phoneNumber: user.phoneNumber,
        phoneVerified: user.phoneVerified
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取当前用户信息
router.get('/me', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        credits: req.user.credits,
        isAdmin: req.user.isAdmin,
        phoneNumber: req.user.phoneNumber,
        phoneVerified: req.user.phoneVerified,
        createdAt: req.user.createdAt
      }
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取当前用户信息 (与 /me 相同，为了兼容前端代码)
router.get('/profile', authenticate, async (req, res) => {
  try {
    console.log('收到获取用户信息请求，用户ID:', req.user._id);
    
    // 从数据库中获取生成次数
    let generationCount = 0;
    
    // 导入GeneratedImage模型
    const GeneratedImage = (await import('../models/GeneratedImage.js')).default;
    
    // 查询用户的生成历史记录数量
    generationCount = await GeneratedImage.countDocuments({ user: req.user._id });
    console.log('用户生成次数:', generationCount);
    
    res.json({
      success: true,
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        credits: req.user.credits,
        isAdmin: req.user.isAdmin,
        phoneNumber: req.user.phoneNumber,
        phoneVerified: req.user.phoneVerified,
        createdAt: req.user.createdAt
      },
      generationCount: generationCount // 返回生成次数
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 用户登出
router.post('/logout', (req, res) => {
  res.cookie('token', '', {
    httpOnly: true,
    expires: new Date(0)
  });
  res.json({ success: true, message: '成功登出' });
});

export default router;
