import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 微信支付配置
const config = {
  appId: process.env.WECHAT_APP_ID, // 微信开放平台 appid
  mchId: process.env.WECHAT_MCH_ID, // 微信支付商户号
  mchKey: process.env.WECHAT_API_KEY, // 商户API密钥，使用WECHAT_API_KEY
  notifyUrl: process.env.WECHAT_NOTIFY_URL, // 支付结果通知回调地址
  // 测试模式判断
  isTestMode: process.env.PAYMENT_TEST_MODE === 'true',
  // 沙箱模式判断，开发环境使用沙箱
  isSandbox: process.env.NODE_ENV !== 'production'
};

/**
 * 生成随机字符串
 * @param {number} length 字符串长度
 * @returns {string} 随机字符串
 */
function generateNonceStr(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonceStr = '';
  for (let i = 0; i < length; i++) {
    nonceStr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonceStr;
}

/**
 * 生成签名
 * @param {Object} params 签名参数
 * @returns {string} 签名
 */
function generateSign(params) {
  // 按照微信支付要求，组装签名参数
  const sortedParams = Object.keys(params).sort().reduce((result, key) => {
    if (params[key] !== '' && params[key] !== undefined && params[key] !== null && key !== 'sign') {
      result[key] = params[key];
    }
    return result;
  }, {});
  
  // 将参数转换为字符串
  let stringA = '';
  for (const key in sortedParams) {
    stringA += `${key}=${sortedParams[key]}&`;
  }
  
  // 拼接API密钥
  const stringSignTemp = `${stringA}key=${config.mchKey}`;
  
  // MD5加密并转为大写
  return crypto.createHash('md5').update(stringSignTemp).digest('hex').toUpperCase();
}

/**
 * XML转换为JS对象
 * @param {string} xml XML字符串
 * @returns {Object} JS对象
 */
function parseXML(xml) {
  const result = {};
  const regex = /<([\w_]+)>(.*?)<\/\1>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    result[match[1]] = match[2];
  }
  return result;
}

/**
 * JS对象转换为XML
 * @param {Object} obj JS对象
 * @returns {string} XML字符串
 */
function objectToXML(obj) {
  let xml = '<xml>';
  for (const key in obj) {
    if (obj[key] !== undefined && obj[key] !== null) {
      xml += `<${key}>${obj[key]}</${key}>`;
    }
  }
  xml += '</xml>';
  return xml;
}

/**
 * 创建微信支付统一下单
 * @param {Object} orderData 订单数据
 * @returns {Promise<Object>} 支付参数
 */
export async function createWechatPayment(orderData) {
  try {
    console.log('============= 开始创建微信支付订单 =============');
    console.log('配置信息检查:');
    console.log('- 测试模式:', config.isTestMode);
    console.log('- 沙箱模式:', config.isSandbox);
    console.log('- AppID:', config.appId ? '已配置' : '未配置');
    console.log('- 商户号:', config.mchId ? '已配置' : '未配置');
    console.log('- API密钥:', config.mchKey ? '已配置' : '未配置');
    console.log('- 回调地址:', config.notifyUrl);
    console.log('订单数据:', JSON.stringify(orderData));
    
    // 测试模式下，直接返回模拟支付成功结果
    if (config.isTestMode) {
      console.log('测试模式：模拟创建微信支付订单');
      return {
        success: true,
        codeUrl: 'weixin://wxpay/bizpayurl?pr=test_code_url',
        orderNumber: orderData.orderNumber,
        amount: orderData.amount,
        timestamp: Math.floor(Date.now() / 1000),
        nonceStr: generateNonceStr(),
        isTestMode: true
      };
    }
    
    // 参数校验
    if (!config.appId) {
      console.error('缺少微信支付AppID配置');
      return { success: false, message: '缺少微信支付AppID配置' };
    }
    if (!config.mchId) {
      console.error('缺少微信支付商户号配置');
      return { success: false, message: '缺少微信支付商户号配置' };
    }
    if (!config.mchKey) {
      console.error('缺少微信支付API密钥配置');
      return { success: false, message: '缺少微信支付API密钥配置' };
    }
    if (!config.notifyUrl) {
      console.error('缺少微信支付回调地址配置');
      return { success: false, message: '缺少微信支付回调地址配置' };
    }
    
    // 构建统一下单参数
    const params = {
      appid: config.appId,
      mch_id: config.mchId,
      nonce_str: generateNonceStr(),
      body: orderData.body || '积分充值',
      out_trade_no: orderData.orderNumber,
      total_fee: Math.floor(orderData.amount * 100), // 将元转为分
      spbill_create_ip: orderData.ip || '127.0.0.1',
      notify_url: config.notifyUrl,
      trade_type: 'NATIVE', // 电脑网页扫码支付
      time_start: new Date().toISOString().replace(/[-T:.Z]/g, '').substring(0, 14),
      time_expire: new Date(Date.now() + 30 * 60 * 1000).toISOString().replace(/[-T:.Z]/g, '').substring(0, 14) // 30分钟后过期
    };
    
    console.log('微信支付请求参数:', JSON.stringify(params));
    
    // 添加签名
    params.sign = generateSign(params);
    console.log('生成的签名:', params.sign);
    
    // 转换为XML
    const xmlData = objectToXML(params);
    console.log('请求XML数据:', xmlData);
    
    // 确定统一下单API地址
    const unifiedOrderUrl = config.isSandbox 
      ? 'https://api.mch.weixin.qq.com/sandboxnew/pay/unifiedorder'
      : 'https://api.mch.weixin.qq.com/pay/unifiedorder';
    console.log('请求API地址:', unifiedOrderUrl);
    
    console.log('正在发起HTTP请求...');
    
    // 发送请求到微信支付API
    try {
      const response = await axios.post(unifiedOrderUrl, xmlData, {
        headers: { 'Content-Type': 'text/xml' },
        timeout: 10000 // 10秒超时
      });
      
      console.log('收到HTTP响应状态码:', response.status);
      console.log('响应数据:', response.data);
      
      // 解析响应XML
      const result = parseXML(response.data);
      console.log('解析后的响应结果:', JSON.stringify(result));
      
      // 检查返回结果
      if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
        console.log('微信支付订单创建成功, 二维码URL:', result.code_url);
        // 成功返回二维码URL
        return {
          success: true,
          codeUrl: result.code_url,
          orderNumber: orderData.orderNumber,
          amount: orderData.amount,
          timestamp: Math.floor(Date.now() / 1000),
          nonceStr: params.nonce_str
        };
      } else {
        console.error('微信支付API返回错误:', 
          result.return_msg || result.err_code_des || '未知错误');
        // 返回错误信息
        return {
          success: false,
          message: result.return_msg || result.err_code_des || '未知错误',
          error: result
        };
      }
    } catch (httpError) {
      console.error('HTTP请求失败:', httpError.message);
      console.error('错误详情:', httpError);
      if (httpError.response) {
        console.error('响应状态码:', httpError.response.status);
        console.error('响应头:', JSON.stringify(httpError.response.headers));
        console.error('响应数据:', httpError.response.data);
      } else if (httpError.request) {
        console.error('请求已发送但没有收到响应');
        console.error('请求对象:', httpError.request);
      }
      
      return {
        success: false,
        message: `HTTP请求失败: ${httpError.message}`,
        error: httpError.toString()
      };
    }
  } catch (error) {
    console.error('创建微信支付订单出错:', error);
    console.error('错误堆栈:', error.stack);
    return {
      success: false,
      message: error.message || '创建支付订单失败',
      error: error.toString()
    };
  } finally {
    console.log('============= 结束创建微信支付订单 =============');
  }
}

/**
 * 验证微信支付回调通知签名
 * @param {Object} notifyData 通知数据
 * @returns {boolean} 是否验签成功
 */
export function verifyNotifySign(notifyData) {
  // 提取微信返回的签名
  const wxSign = notifyData.sign;
  
  // 删除签名字段，重新计算签名
  delete notifyData.sign;
  
  // 生成我方签名
  const sign = generateSign(notifyData);
  
  // 比较签名是否一致
  return sign === wxSign;
}

/**
 * 查询订单状态
 * @param {string} orderNumber 订单号
 * @returns {Promise<Object>} 订单状态
 */
export async function queryOrderStatus(orderNumber) {
  try {
    console.log('============= 开始查询订单状态 =============');
    console.log('订单号:', orderNumber);
    console.log('配置信息检查:');
    console.log('- 测试模式:', config.isTestMode);
    console.log('- 沙箱模式:', config.isSandbox);
    
    // 测试模式下，直接返回模拟支付成功结果
    if (config.isTestMode) {
      console.log('测试模式：模拟查询微信支付订单');
      
      // 50%的概率返回支付成功，模拟实际支付情况
      const isPaid = Math.random() > 0.5;
      console.log('模拟支付状态:', isPaid ? '已支付' : '未支付');
      
      return {
        success: true,
        status: isPaid ? 'SUCCESS' : 'NOTPAY',
        isPaid: isPaid,
        transactionId: isPaid ? `test_${Date.now()}` : '',
        orderNumber: orderNumber,
        amount: 0,
        timeEnd: isPaid ? new Date().toISOString().replace(/[-T:.Z]/g, '').substring(0, 14) : '',
        isTestMode: true
      };
    }
    
    // 构建查询参数
    const params = {
      appid: config.appId,
      mch_id: config.mchId,
      out_trade_no: orderNumber,
      nonce_str: generateNonceStr()
    };
    
    console.log('查询参数:', JSON.stringify(params));
    
    // 添加签名
    params.sign = generateSign(params);
    console.log('生成的签名:', params.sign);
    
    // 转换为XML
    const xmlData = objectToXML(params);
    console.log('请求XML数据:', xmlData);
    
    // 确定订单查询API地址
    const orderQueryUrl = config.isSandbox
      ? 'https://api.mch.weixin.qq.com/sandboxnew/pay/orderquery'
      : 'https://api.mch.weixin.qq.com/pay/orderquery';
    console.log('请求API地址:', orderQueryUrl);
    
    console.log('正在发起HTTP请求...');
    
    // 发送请求到微信支付API
    try {
      const response = await axios.post(orderQueryUrl, xmlData, {
        headers: { 'Content-Type': 'text/xml' },
        timeout: 10000 // 10秒超时
      });
      
      console.log('收到HTTP响应状态码:', response.status);
      console.log('响应数据:', response.data);
      
      // 解析响应XML
      const result = parseXML(response.data);
      console.log('解析后的响应结果:', JSON.stringify(result));
      
      // 检查返回结果
      if (result.return_code === 'SUCCESS') {
        if (result.result_code === 'SUCCESS') {
          console.log('查询成功, 订单状态:', result.trade_state);
          // 返回订单状态
          return {
            success: true,
            status: result.trade_state,
            isPaid: result.trade_state === 'SUCCESS',
            transactionId: result.transaction_id,
            orderNumber: result.out_trade_no,
            amount: parseInt(result.total_fee) / 100, // 将分转为元
            timeEnd: result.time_end
          };
        } else {
          console.error('查询返回业务失败:', result.err_code_des || '订单查询失败');
          return {
            success: false,
            message: result.err_code_des || '订单查询失败',
            error: result
          };
        }
      } else {
        console.error('查询通信失败:', result.return_msg || '通信失败');
        return {
          success: false,
          message: result.return_msg || '通信失败',
          error: result
        };
      }
    } catch (httpError) {
      console.error('HTTP请求失败:', httpError.message);
      if (httpError.response) {
        console.error('响应状态码:', httpError.response.status);
        console.error('响应数据:', httpError.response.data);
      }
      
      return {
        success: false,
        message: `HTTP请求失败: ${httpError.message}`,
        error: httpError.toString()
      };
    }
  } catch (error) {
    console.error('查询微信支付订单出错:', error);
    console.error('错误堆栈:', error.stack);
    return {
      success: false,
      message: error.message || '查询订单失败',
      error: error.toString()
    };
  } finally {
    console.log('============= 结束查询订单状态 =============');
  }
}

/**
 * 关闭订单
 * @param {string} orderNumber 订单号
 * @returns {Promise<Object>} 关闭结果
 */
export async function closeOrder(orderNumber) {
  try {
    console.log('============= 开始关闭订单 =============');
    console.log('订单号:', orderNumber);
    console.log('配置信息检查:');
    console.log('- 测试模式:', config.isTestMode);
    console.log('- 沙箱模式:', config.isSandbox);
    
    // 测试模式下，直接返回模拟关闭成功结果
    if (config.isTestMode) {
      console.log('测试模式：模拟关闭微信支付订单');
      return {
        success: true,
        orderNumber: orderNumber,
        isTestMode: true
      };
    }
    
    // 构建关闭订单参数
    const params = {
      appid: config.appId,
      mch_id: config.mchId,
      out_trade_no: orderNumber,
      nonce_str: generateNonceStr()
    };
    
    console.log('关闭订单参数:', JSON.stringify(params));
    
    // 添加签名
    params.sign = generateSign(params);
    console.log('生成的签名:', params.sign);
    
    // 转换为XML
    const xmlData = objectToXML(params);
    console.log('请求XML数据:', xmlData);
    
    // 确定关闭订单API地址
    const closeOrderUrl = config.isSandbox
      ? 'https://api.mch.weixin.qq.com/sandboxnew/pay/closeorder'
      : 'https://api.mch.weixin.qq.com/pay/closeorder';
    console.log('请求API地址:', closeOrderUrl);
    
    console.log('正在发起HTTP请求...');
    
    // 发送请求到微信支付API
    try {
      const response = await axios.post(closeOrderUrl, xmlData, {
        headers: { 'Content-Type': 'text/xml' },
        timeout: 10000 // 10秒超时
      });
      
      console.log('收到HTTP响应状态码:', response.status);
      console.log('响应数据:', response.data);
      
      // 解析响应XML
      const result = parseXML(response.data);
      console.log('解析后的响应结果:', JSON.stringify(result));
      
      // 检查返回结果
      if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
        console.log('订单关闭成功');
        return {
          success: true,
          orderNumber: orderNumber
        };
      } else {
        console.error('关闭订单失败:', 
          result.return_msg || result.err_code_des || '关闭订单失败');
        return {
          success: false,
          message: result.return_msg || result.err_code_des || '关闭订单失败',
          error: result
        };
      }
    } catch (httpError) {
      console.error('HTTP请求失败:', httpError.message);
      if (httpError.response) {
        console.error('响应状态码:', httpError.response.status);
        console.error('响应数据:', httpError.response.data);
      }
      
      return {
        success: false,
        message: `HTTP请求失败: ${httpError.message}`,
        error: httpError.toString()
      };
    }
  } catch (error) {
    console.error('关闭微信支付订单出错:', error);
    console.error('错误堆栈:', error.stack);
    return {
      success: false,
      message: error.message || '关闭订单失败',
      error: error.toString()
    };
  } finally {
    console.log('============= 结束关闭订单 =============');
  }
} 