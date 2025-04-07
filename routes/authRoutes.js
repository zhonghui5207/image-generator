import express from 'express';
import User from '../models/User.js';
import { generateToken, authenticate } from '../utils/auth.js';
import { sendVerificationCode, sendPasswordResetCode } from '../utils/sms.js';

const router = express.Router();

// 临时存储重置密码验证码（实际环境中应使用Redis或数据库存储）
const resetPasswordCodes = {};

// 生成随机验证码
function generateVerificationCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

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
    console.log('收到登录请求:', req.body);
    const { username, email, password } = req.body;
    
    // 支持使用用户名或邮箱登录
    if ((!username && !email) || !password) {
      return res.status(400).json({ success: false, message: '用户名/邮箱和密码不能为空' });
    }
    
    let user;
    
    // 根据提供的凭据查找用户
    if (email) {
      // 前台登录 - 使用邮箱
      user = await User.findOne({ email });
      console.log('使用邮箱查找用户:', email);
    } else {
      // 后台登录 - 使用用户名
      user = await User.findOne({ username });
      console.log('使用用户名查找用户:', username);
    }
    
    if (!user) {
      return res.status(401).json({ success: false, message: '用户名/邮箱或密码不正确' });
    }
    
    // 验证密码
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: '用户名/邮箱或密码不正确' });
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
    
    console.log('登录成功, 用户:', user.username);
    
    res.json({
      success: true,
      token: token,
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

// 发送重置密码验证码
router.post('/send-reset-code', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: '手机号不能为空' });
    }
    
    // 检查该手机号是否存在
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(400).json({ success: false, message: '该手机号未注册' });
    }
    
    // 生成6位数验证码
    const code = generateVerificationCode();
    
    // 使用专门的密码重置短信模板发送验证码
    const smsResult = await sendPasswordResetCode(phoneNumber, code);
    
    if (!smsResult.success) {
      return res.status(500).json({ 
        success: false, 
        message: '短信发送失败: ' + smsResult.message
      });
    }
    
    // 存储验证码（设置10分钟过期时间）
    resetPasswordCodes[phoneNumber] = {
      code,
      userId: user._id,
      expireAt: Date.now() + 10 * 60 * 1000 // 10分钟后过期
    };
    
    // 在开发环境下返回验证码以便测试
    const response = {
      success: true,
      message: '验证码已发送'
    };
    
    if (process.env.NODE_ENV !== 'production') {
      response.code = code;
    }
    
    res.json(response);
  } catch (error) {
    console.error('发送重置密码验证码错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 验证重置密码验证码
router.post('/verify-reset-code', async (req, res) => {
  try {
    const { phoneNumber, code } = req.body;
    
    if (!phoneNumber || !code) {
      return res.status(400).json({ success: false, message: '手机号和验证码不能为空' });
    }
    
    // 检查验证码是否存在且有效
    const storedData = resetPasswordCodes[phoneNumber];
    if (!storedData) {
      return res.status(400).json({ success: false, message: '验证码不存在或已过期' });
    }
    
    // 检查验证码是否过期
    if (Date.now() > storedData.expireAt) {
      // 删除过期验证码
      delete resetPasswordCodes[phoneNumber];
      return res.status(400).json({ success: false, message: '验证码已过期，请重新获取' });
    }
    
    // 验证码是否匹配
    if (storedData.code !== code) {
      return res.status(400).json({ success: false, message: '验证码不正确' });
    }
    
    // 验证码有效
    res.json({ success: true, message: '验证码验证成功' });
  } catch (error) {
    console.error('验证重置密码验证码错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 重置密码
router.post('/reset-password', async (req, res) => {
  try {
    const { phoneNumber, code, newPassword } = req.body;
    
    if (!phoneNumber || !code || !newPassword) {
      return res.status(400).json({ success: false, message: '手机号、验证码和新密码不能为空' });
    }
    
    // 检查是否通过验证码验证
    const storedData = resetPasswordCodes[phoneNumber];
    if (!storedData) {
      return res.status(400).json({ success: false, message: '请先获取手机验证码' });
    }
    
    // 检查验证码是否过期
    if (Date.now() > storedData.expireAt) {
      // 删除过期验证码
      delete resetPasswordCodes[phoneNumber];
      return res.status(400).json({ success: false, message: '验证码已过期，请重新获取' });
    }
    
    // 验证码是否匹配
    if (storedData.code !== code) {
      return res.status(400).json({ success: false, message: '验证码不正确' });
    }
    
    // 查找用户
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(400).json({ success: false, message: '用户不存在' });
    }
    
    // 更新密码
    user.password = newPassword;
    await user.save();
    
    // 删除已使用的验证码
    delete resetPasswordCodes[phoneNumber];
    
    res.json({ success: true, message: '密码重置成功' });
  } catch (error) {
    console.error('重置密码错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

export default router;
