import express from 'express';
import { authenticate, isAdmin } from '../utils/auth.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import CreditTransaction from '../models/CreditTransaction.js';
import GeneratedImage from '../models/GeneratedImage.js';

const router = express.Router();

// 验证管理员登录并获取信息
router.post('/login', authenticate, async (req, res) => {
  try {
    // 检查是否为管理员
    if (!req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: '没有管理员权限' 
      });
    }
    
    res.json({
      success: true,
      admin: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        isAdmin: req.user.isAdmin
      }
    });
  } catch (error) {
    console.error('管理员登录错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取订单列表
router.get('/orders', authenticate, isAdmin, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      status = '', 
      paymentMethod = '',
      startDate = '',
      endDate = ''
    } = req.query;
    
    // 构建查询条件
    const query = {};
    
    // 添加搜索条件
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    // 添加状态过滤
    if (status) {
      query.status = status;
    }
    
    // 添加支付方式过滤
    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }
    
    // 添加日期范围过滤
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const endDateObj = new Date(endDate);
        endDateObj.setDate(endDateObj.getDate() + 1); // 包含结束日期的整天
        query.createdAt.$lt = endDateObj;
      }
    }
    
    // 计算分页参数
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const pageSize = parseInt(limit);
    
    // 查询订单并填充用户信息
    const orders = await Order.find(query)
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);
    
    // 查询总订单数
    const total = await Order.countDocuments(query);
    
    res.json({
      success: true,
      orders,
      pagination: {
        total,
        page: parseInt(page),
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    console.error('获取订单列表错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取订单统计数据
router.get('/orders/stats', authenticate, isAdmin, async (req, res) => {
  try {
    // 获取今天的开始时间
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 获取本月的开始时间
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    
    // 统计今日订单数和收入
    const todayStats = await Order.aggregate([
      { $match: { 
        createdAt: { $gte: today },
        status: 'paid'
      }},
      { $group: {
        _id: null,
        count: { $sum: 1 },
        revenue: { $sum: '$amount' }
      }}
    ]);
    
    // 统计本月订单数和收入
    const monthStats = await Order.aggregate([
      { $match: { 
        createdAt: { $gte: thisMonth },
        status: 'paid'
      }},
      { $group: {
        _id: null,
        count: { $sum: 1 },
        revenue: { $sum: '$amount' }
      }}
    ]);
    
    // 提取统计结果
    const todayCount = todayStats.length > 0 ? todayStats[0].count : 0;
    const todayRevenue = todayStats.length > 0 ? todayStats[0].revenue : 0;
    const monthCount = monthStats.length > 0 ? monthStats[0].count : 0;
    const monthRevenue = monthStats.length > 0 ? monthStats[0].revenue : 0;
    
    res.json({
      success: true,
      stats: {
        todayCount,
        todayRevenue,
        monthCount,
        monthRevenue
      }
    });
  } catch (error) {
    console.error('获取订单统计错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取用户列表
router.get('/users', authenticate, isAdmin, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '' 
    } = req.query;
    
    // 构建查询条件
    const query = {};
    
    // 添加搜索条件
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // 计算分页参数
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const pageSize = parseInt(limit);
    
    // 查询用户
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);
    
    // 为每个用户附加额外信息
    const usersWithStats = await Promise.all(users.map(async (user) => {
      // 查询用户的生成图像数量
      const imagesCount = await GeneratedImage.countDocuments({ user: user._id });
      
      // 查询用户的订单数量
      const ordersCount = await Order.countDocuments({ user: user._id, status: 'paid' });
      
      // 查询用户的消费总额
      const ordersTotal = await Order.aggregate([
        { $match: { user: user._id, status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      
      return {
        ...user.toObject(),
        stats: {
          imagesCount,
          ordersCount,
          totalSpent: ordersTotal.length > 0 ? ordersTotal[0].total : 0
        }
      };
    }));
    
    // 查询总用户数
    const total = await User.countDocuments(query);
    
    res.json({
      success: true,
      users: usersWithStats,
      pagination: {
        total,
        page: parseInt(page),
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取总体统计数据
router.get('/dashboard', authenticate, isAdmin, async (req, res) => {
  try {
    // 总用户数
    const totalUsers = await User.countDocuments();
    
    // 总订单数和收入
    const orderStats = await Order.aggregate([
      { $match: { status: 'paid' } },
      { $group: {
        _id: null,
        count: { $sum: 1 },
        revenue: { $sum: '$amount' }
      }}
    ]);
    
    // 总生成图像数
    const totalImages = await GeneratedImage.countDocuments();
    
    // 今日新用户
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newUsers = await User.countDocuments({ createdAt: { $gte: today } });
    
    res.json({
      success: true,
      stats: {
        totalUsers,
        totalOrders: orderStats.length > 0 ? orderStats[0].count : 0,
        totalRevenue: orderStats.length > 0 ? orderStats[0].revenue : 0,
        totalImages,
        newUsers
      }
    });
  } catch (error) {
    console.error('获取统计数据错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 为用户充值积分
router.post('/users/:userId/recharge', authenticate, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { credits, reason } = req.body;
    
    // 验证参数
    if (!credits || isNaN(parseInt(credits)) || parseInt(credits) <= 0) {
      return res.status(400).json({ success: false, message: '积分数量必须是一个正整数' });
    }
    
    // 查找用户
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    
    // 更新用户积分
    const creditsToAdd = parseInt(credits);
    user.credits += creditsToAdd;
    await user.save();
    
    // 创建积分交易记录
    const transaction = new CreditTransaction({
      user: userId,
      amount: creditsToAdd,
      type: 'admin_recharge',
      description: reason || '管理员手动充值',
      status: 'completed'
    });
    await transaction.save();
    
    res.json({
      success: true,
      message: `成功为用户 ${user.username} 充值 ${creditsToAdd} 积分`,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        credits: user.credits
      }
    });
  } catch (error) {
    console.error('为用户充值积分错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

export default router;
