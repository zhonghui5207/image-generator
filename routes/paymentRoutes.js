import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../utils/auth.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { createWechatPayment, verifyNotifySign, queryOrderStatus, closeOrder, setOrderProvider, parseXML } from '../utils/wechatpay.js';
import { addCredits } from './creditRoutes.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// 为微信支付模块提供订单查询能力
setOrderProvider(async (orderNumber) => {
  try {
    // 从数据库中查询订单
    return await Order.findOne({ orderNumber });
  } catch (error) {
    console.error('查询订单失败:', error);
    return null;
  }
});

// 生成订单号
async function generateOrderNumber() {
  let orderNumber;
  let isUnique = false;
  let attempts = 0;
  
  // 尝试最多5次生成唯一订单号
  while (!isUnique && attempts < 5) {
    attempts++;
    
    // 使用随机的UUID并移除破折号，确保唯一性
    const uuid = uuidv4().replace(/-/g, '');
    
    // 添加前缀和时间戳（毫秒级）
    const now = new Date();
    const timestamp = now.getTime().toString();
    
    // 将所有元素组合成订单号 - 限制长度为32位以内
    orderNumber = `ORD${timestamp}${uuid.substring(0, 8)}`;
    
    // 检查数据库中是否已存在该订单号
    const existingOrder = await Order.findOne({ orderNumber });
    isUnique = !existingOrder;
    
    if (!isUnique) {
      console.log(`订单号 ${orderNumber} 已存在，尝试重新生成（尝试次数: ${attempts}）`);
    }
  }
  
  if (!isUnique) {
    throw new Error('无法生成唯一订单号，请稍后再试');
  }
  
  console.log(`生成新订单号: ${orderNumber}`);
  return orderNumber;
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
    
    try {
      // 生成唯一订单号
      const orderNumber = await generateOrderNumber();
      
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
      
      // 先保存订单到数据库
      await order.save();
      
      // 根据不同支付方式调用相应的支付接口
      let paymentResult;
      
      try {
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
        
        // 如果支付接口调用成功，保存二维码URL
        if (paymentResult.success && paymentResult.codeUrl) {
          console.log(`成功获取订单 ${orderNumber} 的二维码URL: ${paymentResult.codeUrl.substring(0, 30)}...，正在保存到数据库...`);
          
          // 确保metadata初始化正确
          if (!order.metadata) {
            order.metadata = {};
          }
          
          // 保存二维码URL
          order.metadata.codeUrl = paymentResult.codeUrl;
          
          // 保存到数据库
          await order.save();
          
          // 验证保存是否成功
          const verifyOrder = await Order.findOne({ orderNumber }).lean();
          if (verifyOrder && verifyOrder.metadata && verifyOrder.metadata.codeUrl) {
            console.log(`订单 ${orderNumber} 的二维码URL已成功保存到数据库，验证成功`);
          } else {
            console.error(`订单 ${orderNumber} 的二维码URL保存失败，metadata:`, 
              verifyOrder ? (verifyOrder.metadata ? JSON.stringify(verifyOrder.metadata) : '无metadata') : '未找到订单');
            
            // 尝试使用替代方法更新
            await Order.findOneAndUpdate(
              { orderNumber }, 
              { $set: { "metadata.codeUrl": paymentResult.codeUrl } }
            );
            
            // 再次验证
            const reverifyOrder = await Order.findOne({ orderNumber }).lean();
            console.log(`再次验证: ${reverifyOrder?.metadata?.codeUrl ? '保存成功' : '保存失败'}`);
          }
        } else if (paymentResult.success && paymentResult.isPaid) {
          // 如果订单已支付，更新订单状态
          console.log(`订单 ${orderNumber} 已支付，更新订单状态`);
          order.status = 'paid';
          order.paymentTime = new Date();
          order.transactionId = paymentResult.transactionId || '';
          await order.save();
          
          // 给用户添加积分
          await addCredits(order.user, order.credits, `购买积分 - 订单号:${order.orderNumber}`);
          
          // 更新用户总消费金额
          await User.findByIdAndUpdate(order.user, {
            $inc: { totalSpent: order.amount }
          });
        }
      } catch (error) {
        console.error('调用支付接口错误:', error);
        
        // 如果是订单号重复，这表明有严重问题，因为我们已经确保了订单号唯一性
        if (error.message && error.message.includes('201')) {
          // 标记订单为失败
          order.status = 'failed';
          order.metadata = order.metadata || {};
          order.metadata.error = '支付创建失败：订单号重复 (微信支付系统冲突)';
          await order.save();
          
          return res.status(500).json({
            success: false,
            message: '创建支付订单失败 - 订单号重复',
            error: error.message,
            needRetry: true
          });
        }
        
        // 其他错误
        paymentResult = {
          success: false,
          message: error.message || '创建支付订单失败'
        };
      }
      
      if (!paymentResult || !paymentResult.success) {
        // 支付接口调用失败，标记订单为失败
        order.status = 'failed';
        order.metadata = order.metadata || {};
        order.metadata.error = paymentResult?.message || '创建支付失败';
        await order.save();
        
        return res.status(500).json({
          success: false,
          message: '创建支付订单失败',
          error: paymentResult?.message || '未知错误'
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
      
    } catch (orderGenError) {
      console.error('生成订单号或保存订单错误:', orderGenError);
      return res.status(500).json({ 
        success: false, 
        message: '生成订单失败', 
        error: orderGenError.message,
        needRetry: true
      });
    }
    
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
    
    // 从数据库查询订单，确保获取所有字段包括metadata
    const order = await Order.findOne({ orderNumber }).lean();
    
    if (!order) {
      console.log(`未找到订单: ${orderNumber}`);
      return res.status(404).json({ success: false, message: '订单不存在' });
    }
    
    // 输出订单信息用于调试
    console.log(`获取到订单: ${orderNumber}, metadata:`, 
      order.metadata ? JSON.stringify(order.metadata).substring(0, 100) + '...' : '无metadata'
    );
    
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
    
    console.log(`获取订单 ${orderNumber} 的信息，检查是否有二维码URL...`);
    
    // 获取支付二维码URL
    let paymentResult = null;
    let needRetry = false;
    
    // 先检查订单元数据是否已经有二维码URL
    if (order.metadata && order.metadata.codeUrl) {
      console.log(`订单 ${orderNumber} 在数据库中已存储二维码URL: ${order.metadata.codeUrl.substring(0, 30)}...，直接使用`);
      paymentResult = {
        success: true,
        codeUrl: order.metadata.codeUrl,
        message: '从数据库获取已存在的支付码'
      };
    } else {
      console.log(`订单 ${orderNumber} 在数据库中没有存储二维码URL (metadata: ${JSON.stringify(order.metadata || {})}), 尝试查询支付状态`);
      
      // 首先尝试查询订单在支付平台的状态
      if (order.paymentMethod === 'wechat') {
        try {
          console.log(`查询订单 ${orderNumber} 在微信支付平台的状态`);
          const statusResult = await queryOrderStatus(orderNumber);
          console.log(`订单 ${orderNumber} 状态查询结果:`, JSON.stringify(statusResult));
          
          // 如果查询成功并且支付已完成
          if (statusResult.success && statusResult.isPaid) {
            console.log(`订单 ${orderNumber} 已支付完成，更新状态`);
            // 更新订单为已支付
            order.status = 'paid';
            order.transactionId = statusResult.transactionId;
            order.paymentTime = new Date();
            await Order.findOneAndUpdate({ orderNumber }, {
              status: 'paid',
              transactionId: statusResult.transactionId,
              paymentTime: new Date()
            });
            
            // 给用户添加积分
            await addCredits(order.user, order.credits, `购买积分 - 订单号:${order.orderNumber}`);
            
            // 更新用户总消费金额
            await User.findByIdAndUpdate(order.user, {
              $inc: { totalSpent: order.amount }
            });
            
            return res.json({
              success: true,
              order: {
                orderNumber: order.orderNumber,
                amount: order.amount,
                credits: order.credits,
                paymentMethod: order.paymentMethod,
                status: 'paid',
                paymentTime: order.paymentTime
              },
              payment: {
                success: true,
                isPaid: true,
                message: '订单已支付完成'
              }
            });
          }
          
          // 如果已经在支付平台存在但未支付
          if (statusResult.success && statusResult.exists && !statusResult.isPaid) {
            console.log(`订单 ${orderNumber} 在微信支付平台存在但未支付，检查是否有二维码URL`);
            
            // 先检查返回结果中是否有二维码URL
            if (statusResult.codeUrl) {
              console.log(`微信支付平台返回了订单 ${orderNumber} 的二维码URL，保存并使用`);
              
              // 更新订单metadata
              await Order.findOneAndUpdate(
                { orderNumber }, 
                { 
                  $set: { 
                    "metadata.codeUrl": statusResult.codeUrl 
                  } 
                }
              );
              
              paymentResult = {
                success: true,
                codeUrl: statusResult.codeUrl,
                message: '从微信支付平台获取已存在订单的二维码'
              };
            } else {
              // 没有二维码URL，尝试创建新的支付获取二维码
              console.log(`微信支付平台未返回订单 ${orderNumber} 的二维码URL，尝试创建新支付`);
              try {
                const newPaymentResult = await createWechatPayment({
                  orderNumber,
                  amount: order.amount,
                  body: order.description || `AI绘画平台-积分充值`,
                  ip: req.ip
                });
                
                if (newPaymentResult.success && newPaymentResult.codeUrl) {
                  // 保存新获取的二维码
                  console.log(`成功为订单 ${orderNumber} 获取到新的二维码URL: ${newPaymentResult.codeUrl.substring(0, 30)}...，保存到数据库`);
                  
                  // 更新订单metadata
                  await Order.findOneAndUpdate(
                    { orderNumber }, 
                    { 
                      $set: { 
                        "metadata.codeUrl": newPaymentResult.codeUrl 
                      } 
                    }
                  );
                  
                  paymentResult = newPaymentResult;
                } else if (newPaymentResult.message && (newPaymentResult.message.includes('订单号重复') || newPaymentResult.needRetry)) {
                  // 订单号重复但无法获取二维码，标记需要重试
                  console.log(`订单 ${orderNumber} 无法获取二维码，标记需要创建新订单:`, newPaymentResult.message);
                  needRetry = true;
                }
              } catch (payError) {
                console.error(`为订单 ${orderNumber} 创建支付出错:`, payError);
                // 创建失败，继续后续流程
              }
            }
          }
        } catch (statusError) {
          console.error('查询订单状态错误:', statusError);
          // 查询失败不阻止后续流程
        }
      }
    }
    
    // 再次从数据库获取最新的订单信息，确保拿到最新的metadata
    const updatedOrder = await Order.findOne({ orderNumber }).lean();
    if (updatedOrder?.metadata?.codeUrl && !paymentResult) {
      console.log(`从更新的订单中找到了二维码URL: ${updatedOrder.metadata.codeUrl.substring(0, 30)}...`);
      paymentResult = {
        success: true,
        codeUrl: updatedOrder.metadata.codeUrl,
        message: '从数据库获取最新保存的支付码'
      };
    }
    
    // 如果没有获取到二维码URL，并且需要重试，推荐创建新订单
    if (!paymentResult && needRetry) {
      console.log(`订单 ${orderNumber} 无法获取二维码URL，建议创建新订单`);
      return res.json({
        success: false,
        message: '无法获取支付二维码，请创建新订单',
        needNewOrder: true,
        order: {
          orderNumber: order.orderNumber,
          amount: order.amount,
          credits: order.credits,
          status: order.status
        }
      });
    }
    
    // 如果仍然没有支付URL，尝试创建新的支付
    if (!paymentResult) {
      console.log(`订单 ${orderNumber} 尚未获取到二维码URL，尝试创建新支付`);
      try {
        if (order.paymentMethod === 'wechat') {
          // 调用微信支付获取二维码
          const newPaymentResult = await createWechatPayment({
            orderNumber,
            amount: order.amount,
            body: order.description || `AI绘画平台-积分充值`,
            ip: req.ip
          });
          
          // 如果成功获取了二维码URL，保存到订单元数据中
          if (newPaymentResult.success && newPaymentResult.codeUrl) {
            console.log(`成功为订单 ${orderNumber} 创建支付并获取二维码URL: ${newPaymentResult.codeUrl.substring(0, 30)}...，保存到数据库`);
            
            // 更新订单metadata
            await Order.findOneAndUpdate(
              { orderNumber }, 
              { 
                $set: { 
                  "metadata.codeUrl": newPaymentResult.codeUrl 
                } 
              }
            );
            
            paymentResult = newPaymentResult;
            
            // 保存后再次确认是否已保存成功
            const verifyOrder = await Order.findOne({ orderNumber }).lean();
            console.log(`验证二维码URL是否保存成功: ${verifyOrder?.metadata?.codeUrl ? '成功' : '失败'}`);
          } else {
            paymentResult = newPaymentResult;
          }
        } else if (order.paymentMethod === 'alipay') {
          // 调用支付宝支付
          paymentResult = { success: false, message: '支付宝支付功能尚未实现' };
        }
      } catch (error) {
        console.error('生成支付二维码错误:', error);
        
        // 处理订单重复错误
        if (error.message && (error.message.includes('201') || error.message.includes('订单号重复'))) {
          // 订单重复但未能获取二维码，建议创建新订单
          console.log(`订单 ${orderNumber} 重复但无法获取二维码，建议创建新订单`);
          return res.json({
            success: false,
            message: '订单号已存在但无法获取支付二维码，请尝试创建新订单',
            needNewOrder: true,
            order: {
              orderNumber: order.orderNumber,
              amount: order.amount,
              credits: order.credits,
              status: order.status
            }
          });
        } else {
          // 其他错误
          paymentResult = { 
            success: false, 
            message: error.message || '生成支付二维码失败',
            error: error.toString()
          };
        }
      }
    }
    
    // 获取套餐信息
    const packageInfo = updatedOrder?.metadata || order.metadata || {};
    
    // 如果有支付结果，检查它是否包含isPaid标志
    if (paymentResult && paymentResult.isPaid) {
      console.log(`订单 ${orderNumber} 已支付，更新状态并返回支付成功信息`);
      // 更新订单为已支付
      await Order.findOneAndUpdate(
        { orderNumber },
        {
          status: 'paid',
          transactionId: paymentResult.transactionId || '',
          paymentTime: new Date()
        }
      );
      
      // 给用户添加积分
      await addCredits(order.user, order.credits, `购买积分 - 订单号:${order.orderNumber}`);
      
      // 更新用户总消费金额
      await User.findByIdAndUpdate(order.user, {
        $inc: { totalSpent: order.amount }
      });
      
      return res.json({
        success: true,
        order: {
          orderNumber: order.orderNumber,
          amount: order.amount,
          credits: order.credits,
          paymentMethod: order.paymentMethod,
          status: 'paid',
          paymentTime: new Date()
        },
        payment: {
          success: true,
          isPaid: true,
          message: '订单已支付完成'
        }
      });
    }
    
    // 如果所有尝试都失败，检查订单是否已过期
    const now = new Date();
    if (order.expiredAt && now > order.expiredAt) {
      console.log(`订单 ${orderNumber} 已过期，更新状态`);
      await Order.findOneAndUpdate({ orderNumber }, { status: 'expired' });
      
      return res.json({
        success: false,
        message: '订单已过期，请创建新订单',
        order: {
          orderNumber: order.orderNumber,
          amount: order.amount,
          credits: order.credits,
          status: 'expired'
        }
      });
    }
    
    // 返回订单信息和支付二维码
    console.log(`返回订单 ${orderNumber} 的信息和支付二维码${paymentResult?.success ? ': ' + paymentResult.codeUrl.substring(0, 30) + '...' : ': 无'}`);
    res.json({
      success: paymentResult ? paymentResult.success : false,
      order: {
        orderNumber: order.orderNumber,
        amount: order.amount,
        credits: order.credits,
        paymentMethod: order.paymentMethod,
        expiredAt: order.expiredAt,
        status: order.status,
        packageName: packageInfo.packageName || '积分充值'
      },
      payment: paymentResult || { success: false, message: '无法生成支付二维码' },
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
    console.log('收到微信支付回调请求');
    console.log('原始数据:', req.body);
    
    // 使用已导入的parseXML函数解析XML数据
    const notifyData = parseXML(req.body);
    
    console.log('解析后的回调数据:', notifyData);
    
    // 验证签名
    const signResult = verifyNotifySign(notifyData);
    
    if (!signResult) {
      console.error('微信支付回调验签失败');
      return res.send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[签名验证失败]]></return_msg></xml>');
    }
    
    console.log('签名验证通过');
    
    // 检查返回结果
    if (notifyData.return_code !== 'SUCCESS' || notifyData.result_code !== 'SUCCESS') {
      console.error('微信支付回调返回失败:', notifyData.return_msg || notifyData.err_code_des);
      return res.send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[处理失败]]></return_msg></xml>');
    }
    
    // 获取订单号和交易号
    const orderNumber = notifyData.out_trade_no;
    const transactionId = notifyData.transaction_id;
    const totalFee = parseInt(notifyData.total_fee) / 100; // 转换为元
    
    console.log(`处理订单 ${orderNumber}, 交易号 ${transactionId}, 金额 ${totalFee}元`);
    
    // 查询订单
    const order = await Order.findOne({ orderNumber });
    
    if (!order) {
      console.error('微信支付回调找不到订单:', orderNumber);
      return res.send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[订单不存在]]></return_msg></xml>');
    }
    
    console.log('找到订单:', order);
    
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
    
    console.log('开始更新订单状态...');
    
    // 更新订单状态
    order.status = 'paid';
    order.transactionId = transactionId;
    order.paymentTime = new Date();
    await order.save();
    
    console.log('订单状态已更新为已支付');
    
    // 给用户添加积分
    console.log(`准备给用户 ${order.user} 添加 ${order.credits} 积分`);
    await addCredits(order.user, order.credits, `购买积分 - 订单号:${order.orderNumber}`);
    console.log('积分添加成功');
    
    // 更新用户总消费金额
    await User.findByIdAndUpdate(order.user, {
      $inc: { totalSpent: order.amount }
    });
    console.log(`用户总消费金额已更新，增加 ${order.amount} 元`);
    
    // 返回成功
    console.log('处理完成，返回成功响应');
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