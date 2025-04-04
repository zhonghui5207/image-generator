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
  mchKey: process.env.WECHAT_MCH_KEY, // 商户API密钥
  notifyUrl: process.env.WECHAT_NOTIFY_URL, // 支付结果通知回调地址
  // 开发环境使用沙箱环境，生产环境使用真实环境
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
    
    // 添加签名
    params.sign = generateSign(params);
    
    // 转换为XML
    const xmlData = objectToXML(params);
    
    // 确定统一下单API地址
    const unifiedOrderUrl = config.isSandbox 
      ? 'https://api.mch.weixin.qq.com/sandboxnew/pay/unifiedorder'
      : 'https://api.mch.weixin.qq.com/pay/unifiedorder';
    
    console.log('正在发起微信支付请求:', params);
    
    // 发送请求到微信支付API
    const response = await axios.post(unifiedOrderUrl, xmlData, {
      headers: { 'Content-Type': 'text/xml' }
    });
    
    console.log('微信支付API响应:', response.data);
    
    // 解析响应XML
    const result = parseXML(response.data);
    
    // 检查返回结果
    if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
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
      // 返回错误信息
      return {
        success: false,
        message: result.return_msg || result.err_code_des || '未知错误',
        error: result
      };
    }
  } catch (error) {
    console.error('创建微信支付订单出错:', error);
    return {
      success: false,
      message: error.message || '创建支付订单失败',
      error: error.toString()
    };
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
    // 构建查询参数
    const params = {
      appid: config.appId,
      mch_id: config.mchId,
      out_trade_no: orderNumber,
      nonce_str: generateNonceStr()
    };
    
    // 添加签名
    params.sign = generateSign(params);
    
    // 转换为XML
    const xmlData = objectToXML(params);
    
    // 确定订单查询API地址
    const orderQueryUrl = config.isSandbox
      ? 'https://api.mch.weixin.qq.com/sandboxnew/pay/orderquery'
      : 'https://api.mch.weixin.qq.com/pay/orderquery';
    
    // 发送请求到微信支付API
    const response = await axios.post(orderQueryUrl, xmlData, {
      headers: { 'Content-Type': 'text/xml' }
    });
    
    // 解析响应XML
    const result = parseXML(response.data);
    
    // 检查返回结果
    if (result.return_code === 'SUCCESS') {
      if (result.result_code === 'SUCCESS') {
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
        return {
          success: false,
          message: result.err_code_des || '订单查询失败',
          error: result
        };
      }
    } else {
      return {
        success: false,
        message: result.return_msg || '通信失败',
        error: result
      };
    }
  } catch (error) {
    console.error('查询微信支付订单出错:', error);
    return {
      success: false,
      message: error.message || '查询订单状态失败',
      error: error.toString()
    };
  }
}

/**
 * 关闭订单
 * @param {string} orderNumber 订单号
 * @returns {Promise<Object>} 关闭结果
 */
export async function closeOrder(orderNumber) {
  try {
    // 构建关闭订单参数
    const params = {
      appid: config.appId,
      mch_id: config.mchId,
      out_trade_no: orderNumber,
      nonce_str: generateNonceStr()
    };
    
    // 添加签名
    params.sign = generateSign(params);
    
    // 转换为XML
    const xmlData = objectToXML(params);
    
    // 确定关闭订单API地址
    const closeOrderUrl = config.isSandbox
      ? 'https://api.mch.weixin.qq.com/sandboxnew/pay/closeorder'
      : 'https://api.mch.weixin.qq.com/pay/closeorder';
    
    // 发送请求到微信支付API
    const response = await axios.post(closeOrderUrl, xmlData, {
      headers: { 'Content-Type': 'text/xml' }
    });
    
    // 解析响应XML
    const result = parseXML(response.data);
    
    // 检查返回结果
    if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
      return {
        success: true,
        message: '订单关闭成功',
        orderNumber
      };
    } else {
      return {
        success: false,
        message: result.return_msg || result.err_code_des || '关闭订单失败',
        error: result
      };
    }
  } catch (error) {
    console.error('关闭微信订单出错:', error);
    return {
      success: false,
      message: error.message || '关闭订单失败',
      error: error.toString()
    };
  }
} 