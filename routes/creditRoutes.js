import express from 'express';
import User from '../models/User.js';
import CreditTransaction from '../models/CreditTransaction.js';
import { authenticate, isAdmin } from '../utils/auth.js';

const router = express.Router();

// 获取用户积分余额
router.get('/balance', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      success: true,
      credits: user.credits
    });
  } catch (error) {
    console.error('获取积分余额错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取用户所有积分交易历史
router.get('/transactions', authenticate, async (req, res) => {
  try {
    const transactions = await CreditTransaction.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20);
    
    res.json({
      success: true,
      transactions
    });
  } catch (error) {
    console.error('获取积分交易历史错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取用户积分购买记录
router.get('/purchases', authenticate, async (req, res) => {
  try {
    const purchases = await CreditTransaction.find({ 
      user: req.user._id,
      type: 'purchase'
    })
      .sort({ createdAt: -1 })
      .limit(20);
    
    res.json({
      success: true,
      purchases
    });
  } catch (error) {
    console.error('获取积分购买记录错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取用户积分使用记录（带分页）
router.get('/usage-history', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // 查询记录总数
    const total = await CreditTransaction.countDocuments({ 
      user: req.user._id,
      type: 'usage'
    });
    
    // 获取分页数据
    const records = await CreditTransaction.find({ 
      user: req.user._id,
      type: 'usage'
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    res.json({
      success: true,
      records,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取积分使用记录错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 购买积分（模拟支付）
router.post('/purchase', authenticate, async (req, res) => {
  try {
    const { packageId } = req.body;
    
    // 积分包定义
    const packages = {
      basic: { credits: 10, price: 9.99 },
      standard: { credits: 50, price: 39.99 },
      premium: { credits: 120, price: 79.99 }
    };
    
    // 验证积分包是否存在
    if (!packages[packageId]) {
      return res.status(400).json({ success: false, message: '无效的积分包' });
    }
    
    const selectedPackage = packages[packageId];
    
    // 模拟支付成功
    // 在实际应用中，这里应该集成支付网关如支付宝、微信支付或Stripe
    
    // 更新用户积分
    const user = await User.findById(req.user._id);
    user.credits += selectedPackage.credits;
    await user.save();
    
    // 记录交易
    await CreditTransaction.create({
      user: req.user._id,
      amount: selectedPackage.credits,
      type: 'purchase',
      description: `购买${selectedPackage.credits}积分`,
      orderId: `ORDER-${Date.now()}`
    });
    
    res.json({
      success: true,
      message: `成功购买${selectedPackage.credits}积分`,
      newBalance: user.credits
    });
  } catch (error) {
    console.error('购买积分错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 使用积分（内部API，由图像生成API调用）
export const useCredits = async (userId, amount, description, imageId) => {
  try {
    // 查找用户
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }
    
    // 检查积分余额
    if (user.credits < amount) {
      throw new Error('积分不足');
    }
    
    // 扣除积分
    user.credits -= amount;
    await user.save();
    
    // 记录交易
    await CreditTransaction.create({
      user: userId,
      amount: -amount,
      type: 'usage',
      description,
      imageId
    });
    
    return user.credits; // 返回新的积分余额
  } catch (error) {
    console.error('使用积分错误:', error);
    throw error;
  }
};

// 添加积分（内部API，由支付系统调用）
export const addCredits = async (userId, amount, description, orderId) => {
  try {
    // 查找用户
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }
    
    // 验证参数
    if (!amount || amount <= 0) {
      throw new Error('无效的积分数量');
    }
    
    // 增加积分
    user.credits += amount;
    await user.save();
    
    // 记录交易
    await CreditTransaction.create({
      user: userId,
      amount: amount,
      type: 'purchase',
      description: description || '购买积分',
      orderId
    });
    
    return user.credits; // 返回新的积分余额
  } catch (error) {
    console.error('添加积分错误:', error);
    throw error;
  }
};

// 管理员：赠送积分
router.post('/gift', authenticate, isAdmin, async (req, res) => {
  try {
    const { userId, amount, reason } = req.body;
    
    // 验证参数
    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: '无效的参数' });
    }
    
    // 查找用户
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    
    // 增加积分
    user.credits += amount;
    await user.save();
    
    // 记录交易
    await CreditTransaction.create({
      user: userId,
      amount,
      type: 'gift',
      description: reason || '管理员赠送积分'
    });
    
    res.json({
      success: true,
      message: `成功赠送${amount}积分给用户${user.username}`,
      newBalance: user.credits
    });
  } catch (error) {
    console.error('赠送积分错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

export default router;
