import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../utils/auth.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { createWechatPayment, verifyNotifySign, queryOrderStatus } from '../utils/wechatpay.js';
import { addCredits } from './creditRoutes.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// 生成订单号
function generateOrderNumber() {
  const timestamp = new Date().getTime().toString().substring(0, 10);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD${timestamp}${random}`;
}

// 获取积分套餐
router.get('/packages', (req, res) => {
  // 从环境变量或配置文件中读取套餐信息
  const creditPackages = [
    { id: 1, credits: 100, price: 9.9, name: '基础套餐', description: '体验AI绘画的魅力' },
    { id: 2, credits: 500, price: 39.9, name: '标准套餐', discount: 0.9, description: '适合轻度使用' },
    { id: 3, credits: 1200, price: 99.9, name: '高级套餐', discount: 0.8, description: '高性价比的选择' },
    { id: 4, credits: 200, price: 15.00, name: '专业套餐', discount: 0.75, description: '专业创作者首选' },
    { id: 5, credits: 500, price: 35.00, name: 'AI画师套餐', discount: 0.7, description: '大量创作的理想选择' },
    { id: 6, credits: 1000, price: 65.00, name: '工作室套餐', discount: 0.65, description: '为团队和工作室设计' }
  ];
  
  res.json({ success: true, packages: creditPackages });
});

// 创建订单
router.post('/create-order', authenticate, async (req, res) => {
  try {
    const { packageId, paymentMethod } = req.body;
    
    // 验证支付方式
    if (!['wechat', 'alipay'].includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: '不支持的支付方式' });
    }
    
    // 获取套餐信息
    const creditPackages = [
      { id: 1, credits: 100, price: 9.9, name: '基础套餐', description: '体验AI绘画的魅力' },
      { id: 2, credits: 500, price: 39.9, name: '标准套餐', discount: 0.9, description: '适合轻度使用' },
      { id: 3, credits: 1200, price: 99.9, name: '高级套餐', discount: 0.8, description: '高性价比的选择' },
      { id: 4, credits: 200, price: 15.00, name: '专业套餐', discount: 0.75, description: '专业创作者首选' },
      { id: 5, credits: 500, price: 35.00, name: 'AI画师套餐', discount: 0.7, description: '大量创作的理想选择' },
      { id: 6, credits: 1000, price: 65.00, name: '工作室套餐', discount: 0.65, description: '为团队和工作室设计' }
    ];
    
    const selectedPackage = creditPackages.find(pkg => pkg.id === parseInt(packageId));
    
    if (!selectedPackage) {
      return res.status(400).json({ success: false, message: '无效的套餐ID' });
    }
    
    // 生成唯一订单号
    const orderNumber = generateOrderNumber();
    
    // 设置订单过期时间（30分钟后）
    const expiredAt = new Date(Date.now() + 30 * 60 * 1000);
    
    // 创建订单记录
    const order = new Order({
      user: req.user._id,
      orderNumber,
      amount: selectedPackage.price,
      credits: selectedPackage.credits,
      paymentMethod,
      status: 'pending',
      expiredAt,
      description: `购买${selectedPackage.name}：${selectedPackage.credits}积分`,
      metadata: { 
        packageId: selectedPackage.id,
        packageName: selectedPackage.name
      }
    });
    
    await order.save();
    
    // 根据不同支付方式调用相应的支付接口
    let paymentResult;
    
    if (paymentMethod === 'wechat') {
      // 调用微信支付
      paymentResult = await createWechatPayment({
        orderNumber,
        amount: selectedPackage.price,
        body: `AI绘画平台-${selectedPackage.name}`,
        ip: req.ip
      });
    } else if (paymentMethod === 'alipay') {
      // 调用支付宝支付（这里需要再实现）
      paymentResult = { success: false, message: '支付宝支付功能尚未实现' };
    }
    
    if (!paymentResult.success) {
      // 支付接口调用失败，标记订单为失败
      order.status = 'failed';
      order.metadata.error = paymentResult.message;
      await order.save();
      
      return res.status(500).json({
        success: false,
        message: '创建支付订单失败',
        error: paymentResult.message
      });
    }
    
    // 返回支付信息
    res.json({
      success: true,
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        amount: order.amount,
        credits: order.credits,
        paymentMethod: order.paymentMethod,
        expiredAt: order.expiredAt
      },
      payment: paymentResult,
      package: selectedPackage
    });
    
  } catch (error) {
    console.error('创建订单错误:', error);
    res.status(500).json({ success: false, message: '创建订单失败', error: error.message });
  }
});

// 查询订单状态
router.get('/order-status/:orderNumber', authenticate, async (req, res) => {
  try {
    const { orderNumber } = req.params;
    
    // 从数据库查询订单
    const order = await Order.findOne({ orderNumber });
    
    if (!order) {
      return res.status(404).json({ success: false, message: '订单不存在' });
    }
    
    // 检查是否是当前用户的订单
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: '无权访问此订单' });
    }
    
    // 如果订单已经支付成功，直接返回
    if (order.status === 'paid') {
      return res.json({
        success: true,
        status: order.status,
        orderNumber: order.orderNumber,
        amount: order.amount,
        credits: order.credits,
        paymentTime: order.paymentTime
      });
    }
    
    // 如果订单已经取消或过期，直接返回
    if (['cancelled', 'expired', 'failed'].includes(order.status)) {
      return res.json({
        success: true,
        status: order.status,
        orderNumber: order.orderNumber,
        amount: order.amount
      });
    }
    
    // 主动查询订单状态
    let paymentStatus;
    
    if (order.paymentMethod === 'wechat') {
      // 查询微信支付订单状态
      paymentStatus = await queryOrderStatus(orderNumber);
    } else if (order.paymentMethod === 'alipay') {
      // 查询支付宝订单状态（需要实现）
      paymentStatus = { success: false, message: '支付宝查询功能尚未实现' };
    }
    
    // 如果查询成功并且支付成功
    if (paymentStatus.success && paymentStatus.isPaid) {
      // 更新订单为已支付
      order.status = 'paid';
      order.transactionId = paymentStatus.transactionId;
      order.paymentTime = new Date();
      await order.save();
      
      // 给用户添加积分
      await addCredits(order.user, order.credits, `购买积分 - 订单号:${order.orderNumber}`);
      
      // 更新用户总消费金额
      await User.findByIdAndUpdate(order.user, {
        $inc: { totalSpent: order.amount }
      });
      
      return res.json({
        success: true,
        status: order.status,
        orderNumber: order.orderNumber,
        amount: order.amount,
        credits: order.credits,
        paymentTime: order.paymentTime
      });
    }
    
    // 检查订单是否已过期
    if (new Date() > order.expiredAt && order.status === 'pending') {
      order.status = 'expired';
      await order.save();
    }
    
    // 返回当前订单状态
    res.json({
      success: true,
      status: order.status,
      orderNumber: order.orderNumber,
      amount: order.amount,
      credits: order.credits,
      expiresIn: Math.max(0, Math.floor((order.expiredAt - new Date()) / 1000))
    });
    
  } catch (error) {
    console.error('查询订单状态错误:', error);
    res.status(500).json({ success: false, message: '查询订单状态失败', error: error.message });
  }
});

// 获取订单信息（用于支付页面）
router.get('/order-info/:orderNumber', authenticate, async (req, res) => {
  try {
    const { orderNumber } = req.params;
    
    // 从数据库查询订单
    const order = await Order.findOne({ orderNumber });
    
    if (!order) {
      return res.status(404).json({ success: false, message: '订单不存在' });
    }
    
    // 检查是否是当前用户的订单
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: '无权访问此订单' });
    }
    
    // 如果订单状态不是 pending，则无法继续支付
    if (order.status !== 'pending') {
      return res.json({
        success: false,
        message: `订单状态为 ${order.status}，无法继续支付`,
        order: {
          orderNumber: order.orderNumber,
          amount: order.amount,
          credits: order.credits,
          status: order.status
        }
      });
    }
    
    // 获取支付二维码URL
    let paymentResult;
    
    // 检查订单元数据中是否已经存储了二维码URL
    if (order.metadata && order.metadata.codeUrl) {
      // 使用已存储的二维码URL
      paymentResult = {
        success: true,
        codeUrl: order.metadata.codeUrl
      };
    } else {
      // 没有存储二维码URL，生成新的支付二维码
      if (order.paymentMethod === 'wechat') {
        // 调用微信支付获取二维码
        paymentResult = await createWechatPayment({
          orderNumber,
          amount: order.amount,
          body: order.description || `AI绘画平台-积分充值`,
          ip: req.ip
        });
        
        // 如果成功获取了二维码URL，保存到订单元数据中
        if (paymentResult.success && paymentResult.codeUrl) {
          order.metadata = order.metadata || {};
          order.metadata.codeUrl = paymentResult.codeUrl;
          await order.save();
        }
      } else if (order.paymentMethod === 'alipay') {
        // 调用支付宝支付（这里需要再实现）
        paymentResult = { success: false, message: '支付宝支付功能尚未实现' };
      }
    }
    
    // 获取套餐信息
    const packageInfo = order.metadata || {};
    
    // 返回订单信息和支付二维码
    res.json({
      success: true,
      order: {
        orderNumber: order.orderNumber,
        amount: order.amount,
        credits: order.credits,
        paymentMethod: order.paymentMethod,
        expiredAt: order.expiredAt,
        status: order.status,
        packageName: packageInfo.packageName || '积分充值'
      },
      payment: paymentResult,
      package: {
        id: packageInfo.packageId,
        name: packageInfo.packageName || '积分充值'
      }
    });
    
  } catch (error) {
    console.error('获取订单信息错误:', error);
    res.status(500).json({ success: false, message: '获取订单信息失败', error: error.message });
  }
});

// 取消订单
router.post('/cancel-order/:orderNumber', authenticate, async (req, res) => {
  try {
    const { orderNumber } = req.params;
    
    // 从数据库查询订单
    const order = await Order.findOne({ orderNumber });
    
    if (!order) {
      return res.status(404).json({ success: false, message: '订单不存在' });
    }
    
    // 检查是否是当前用户的订单
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: '无权操作此订单' });
    }
    
    // 检查订单是否可以取消（只有待支付的订单可以取消）
    if (order.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: `无法取消状态为 ${order.status} 的订单`
      });
    }
    
    // 根据支付方式关闭对应的支付订单
    if (order.paymentMethod === 'wechat') {
      // 关闭微信支付订单
      await closeOrder(orderNumber);
    } else if (order.paymentMethod === 'alipay') {
      // 关闭支付宝订单（需要实现）
    }
    
    // 更新订单状态为已取消
    order.status = 'cancelled';
    await order.save();
    
    res.json({
      success: true,
      message: '订单已取消',
      orderNumber: order.orderNumber
    });
    
  } catch (error) {
    console.error('取消订单错误:', error);
    res.status(500).json({ success: false, message: '取消订单失败', error: error.message });
  }
});

// 微信支付回调通知
router.post('/wechat-notify', express.text({ type: 'text/xml' }), async (req, res) => {
  try {
    // 解析XML数据
    const notifyData = {};
    const regex = /<([\w_]+)>(.*?)<\/\1>/g;
    let match;
    
    while ((match = regex.exec(req.body)) !== null) {
      notifyData[match[1]] = match[2];
    }
    
    console.log('收到微信支付回调:', notifyData);
    
    // 验证签名
    if (!verifyNotifySign(notifyData)) {
      console.error('微信支付回调验签失败');
      return res.send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[签名验证失败]]></return_msg></xml>');
    }
    
    // 检查返回结果
    if (notifyData.return_code !== 'SUCCESS' || notifyData.result_code !== 'SUCCESS') {
      console.error('微信支付回调返回失败:', notifyData.return_msg || notifyData.err_code_des);
      return res.send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[处理失败]]></return_msg></xml>');
    }
    
    // 获取订单号和交易号
    const orderNumber = notifyData.out_trade_no;
    const transactionId = notifyData.transaction_id;
    const totalFee = parseInt(notifyData.total_fee) / 100; // 转换为元
    
    // 查询订单
    const order = await Order.findOne({ orderNumber });
    
    if (!order) {
      console.error('微信支付回调找不到订单:', orderNumber);
      return res.send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[订单不存在]]></return_msg></xml>');
    }
    
    // 检查订单金额是否一致（允许1分钱的误差）
    if (Math.abs(order.amount - totalFee) > 0.01) {
      console.error(`微信支付回调金额不匹配: 订单金额 ${order.amount}, 支付金额 ${totalFee}`);
      return res.send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[金额不一致]]></return_msg></xml>');
    }
    
    // 检查订单是否已经处理过
    if (order.status === 'paid') {
      console.log('订单已支付，不重复处理:', orderNumber);
      return res.send('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>');
    }
    
    // 更新订单状态
    order.status = 'paid';
    order.transactionId = transactionId;
    order.paymentTime = new Date();
    await order.save();
    
    // 给用户添加积分
    await addCredits(order.user, order.credits, `购买积分 - 订单号:${order.orderNumber}`);
    
    // 更新用户总消费金额
    await User.findByIdAndUpdate(order.user, {
      $inc: { totalSpent: order.amount }
    });
    
    // 返回成功
    res.send('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>');
    
  } catch (error) {
    console.error('处理微信支付回调错误:', error);
    res.send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[服务器内部错误]]></return_msg></xml>');
  }
});

// 获取用户订单历史
router.get('/order-history', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    // 构建查询条件
    const query = { user: req.user._id };
    
    // 如果指定了状态，添加到查询条件
    if (status && ['pending', 'paid', 'failed', 'cancelled', 'expired'].includes(status)) {
      query.status = status;
    }
    
    // 分页查询
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // 查询订单
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // 获取总订单数
    const total = await Order.countDocuments(query);
    
    res.json({
      success: true,
      orders: orders.map(order => ({
        id: order._id,
        orderNumber: order.orderNumber,
        amount: order.amount,
        credits: order.credits,
        status: order.status,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        paymentTime: order.paymentTime,
        description: order.description,
        metadata: order.metadata
      })),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('获取订单历史错误:', error);
    res.status(500).json({ success: false, message: '获取订单历史失败', error: error.message });
  }
});

export default router; 