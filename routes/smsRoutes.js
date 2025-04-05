import express from 'express';
import { sendVerificationCode } from '../utils/sms.js';
import { authenticate } from '../utils/auth.js';
import User from '../models/User.js';

const router = express.Router();

// 临时存储验证码的对象（实际环境中应使用 Redis 或数据库存储）
const verificationCodes = {};

// 生成随机验证码
function generateVerificationCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

// 发送短信验证码
router.post('/send-verification-code', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: '手机号不能为空' });
    }
    
    // 生成6位数验证码
    const code = generateVerificationCode();
    
    // 发送验证码短信
    const result = await sendVerificationCode(phoneNumber, code);
    
    if (result.success) {
      // 存储验证码（设置5分钟过期时间）
      verificationCodes[phoneNumber] = {
        code,
        expireAt: Date.now() + 5 * 60 * 1000 // 5分钟后过期
      };
      
      // 在正式环境中不返回验证码
      const response = {
        success: true,
        message: '验证码已发送',
      };
      
      // 在开发环境中返回验证码以便测试
      if (process.env.NODE_ENV !== 'production') {
        response.code = code;
      }
      
      return res.json(response);
    } else {
      return res.status(500).json({ 
        success: false, 
        message: '验证码发送失败',
        error: result.message
      });
    }
  } catch (error) {
    console.error('发送验证码错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 验证短信验证码
router.post('/verify-code', async (req, res) => {
  try {
    const { phoneNumber, code } = req.body;
    
    if (!phoneNumber || !code) {
      return res.status(400).json({ 
        success: false, 
        message: '手机号和验证码不能为空' 
      });
    }
    
    // 检查验证码是否存在且有效
    const storedVerification = verificationCodes[phoneNumber];
    if (!storedVerification) {
      return res.status(400).json({ 
        success: false, 
        message: '验证码不存在或已过期，请重新获取' 
      });
    }
    
    // 检查验证码是否过期
    if (Date.now() > storedVerification.expireAt) {
      // 删除过期验证码
      delete verificationCodes[phoneNumber];
      return res.status(400).json({ 
        success: false, 
        message: '验证码已过期，请重新获取' 
      });
    }
    
    // 验证码是否匹配
    if (storedVerification.code !== code) {
      return res.status(400).json({ 
        success: false, 
        message: '验证码不正确' 
      });
    }
    
    // 验证码有效，删除已使用的验证码
    delete verificationCodes[phoneNumber];
    
    res.json({ 
      success: true, 
      message: '验证码验证成功' 
    });
  } catch (error) {
    console.error('验证码验证错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 验证并绑定手机号（改进版，更好的错误处理和用户体验）
router.post('/verify-phone', authenticate, async (req, res) => {
  try {
    const { phoneNumber, code } = req.body;
    
    if (!phoneNumber || !code) {
      return res.status(400).json({ 
        success: false, 
        message: '手机号和验证码不能为空' 
      });
    }
    
    // 检查验证码是否有效
    const storedVerification = verificationCodes[phoneNumber];
    if (!storedVerification) {
      return res.status(400).json({
        success: false,
        message: '验证码不存在，请重新获取'
      });
    }
    
    if (Date.now() > storedVerification.expireAt) {
      // 删除过期验证码
      delete verificationCodes[phoneNumber];
      return res.status(400).json({
        success: false,
        message: '验证码已过期，请重新获取'
      });
    }
    
    if (storedVerification.code !== code) {
      return res.status(400).json({
        success: false,
        message: '验证码不正确'
      });
    }
    
    // 检查手机号是否已被其他用户绑定
    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser && existingUser._id.toString() !== req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: '该手机号已被其他账号绑定',
        phoneAlreadyBound: true
      });
    }
    
    // 更新用户信息，绑定手机号
    req.user.phoneNumber = phoneNumber;
    req.user.phoneVerified = true;
    await req.user.save();
    
    // 删除已使用的验证码
    delete verificationCodes[phoneNumber];
    
    res.json({
      success: true,
      message: '手机号绑定成功',
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        phoneNumber: req.user.phoneNumber,
        phoneVerified: req.user.phoneVerified,
        credits: req.user.credits
      }
    });
  } catch (error) {
    console.error('验证绑定手机号错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 绑定手机号（需要用户登录）- 保留老接口以兼容
router.post('/bind-phone', authenticate, async (req, res) => {
  try {
    const { phoneNumber, code } = req.body;
    
    if (!phoneNumber || !code) {
      return res.status(400).json({ 
        success: false, 
        message: '手机号和验证码不能为空' 
      });
    }
    
    // 检查验证码是否有效
    const storedVerification = verificationCodes[phoneNumber];
    if (!storedVerification || Date.now() > storedVerification.expireAt || storedVerification.code !== code) {
      return res.status(400).json({
        success: false,
        message: '验证码无效或已过期，请重新获取'
      });
    }
    
    // 检查手机号是否已被其他用户绑定
    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser && existingUser._id.toString() !== req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: '该手机号已被其他账号绑定'
      });
    }
    
    // 更新用户信息，绑定手机号
    req.user.phoneNumber = phoneNumber;
    req.user.phoneVerified = true;
    await req.user.save();
    
    // 删除已使用的验证码
    delete verificationCodes[phoneNumber];
    
    res.json({
      success: true,
      message: '手机号绑定成功',
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        phoneNumber: req.user.phoneNumber,
        phoneVerified: req.user.phoneVerified,
        credits: req.user.credits
      }
    });
  } catch (error) {
    console.error('绑定手机号错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

export default router; 