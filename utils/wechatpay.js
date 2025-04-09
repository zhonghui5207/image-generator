import crypto from 'crypto';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// 微信支付配置
const config = {
  appId: process.env.WECHAT_APP_ID, // 微信开放平台 appid
  mchId: process.env.WECHAT_MCH_ID, // 微信支付商户号
  mchKey: process.env.WECHAT_API_KEY, // 商户API密钥
  notifyUrl: process.env.WECHAT_NOTIFY_URL || 'https://kdy-imagic.lovexstory.com/api/payment/wechat-notify' // 支付结果通知回调地址
};

// 验证配置
console.log('微信支付配置初始化...');
if (!config.appId || !config.mchId || !config.mchKey) {
  console.error('缺少必要的微信支付配置参数');
} else {
  console.log('微信支付配置加载完成');
  console.log('回调通知地址:', config.notifyUrl);
  
  // 验证回调URL是否使用HTTPS
  if (!config.notifyUrl.startsWith('https://')) {
    console.warn('警告: 回调通知URL必须使用HTTPS协议');
  }
}

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
  
  // 处理基本的XML标签
  const tagRegex = /<([\w_]+)>(.*?)<\/\1>/g;
  let match;
  while ((match = tagRegex.exec(xml)) !== null) {
    const key = match[1];
    let value = match[2];
    
    // 检查是否包含CDATA
    const cdataMatch = /<!\[CDATA\[(.*?)\]\]>/.exec(value);
    if (cdataMatch) {
      value = cdataMatch[1]; // 提取CDATA中的实际内容
    }
    
    result[key] = value;
  }
  
  // 单独处理带CDATA的标签
  const cdataRegex = /<([\w_]+)><!\[CDATA\[(.*?)\]\]><\/\1>/g;
  while ((match = cdataRegex.exec(xml)) !== null) {
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
    console.log('创建微信支付订单:', orderData.orderNumber, '金额:', orderData.amount);
    
    // 参数校验
    if (!config.appId || !config.mchId || !config.mchKey || !config.notifyUrl) {
      console.error('缺少微信支付配置');
      return { success: false, message: '缺少微信支付配置' };
    }
    
    // 先查询订单是否已经存在
    try {
      const orderStatus = await queryOrderStatus(orderData.orderNumber);
      // 如果订单已存在于微信支付系统
      if (orderStatus.exists) {
        console.log(`订单 ${orderData.orderNumber} 已存在于微信支付系统中, 状态:`, orderStatus);
        
        // 如果订单已支付，直接返回支付成功
        if (orderStatus.isPaid) {
          return {
            success: true,
            isPaid: true,
            orderNumber: orderData.orderNumber,
            amount: orderData.amount,
            message: '订单已支付'
          };
        }
        
        // 如果订单存在但未支付，且有codeUrl，直接返回原有的codeUrl
        if (orderStatus.codeUrl) {
          return {
            success: true,
            codeUrl: orderStatus.codeUrl,
            orderNumber: orderData.orderNumber,
            amount: orderData.amount,
            timestamp: Math.floor(Date.now() / 1000),
            nonceStr: generateNonceStr(),
            message: '使用已存在的支付二维码'
          };
        }
      }
    } catch (queryError) {
      // 查询失败不影响后续创建
      console.log(`查询订单 ${orderData.orderNumber} 状态失败, 继续创建新订单:`, queryError.message || queryError);
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
      trade_type: 'NATIVE' // 电脑网页扫码支付
    };
    
    // 添加签名
    params.sign = generateSign(params);
    
    // 转换为XML
    const xmlData = objectToXML(params);
    
    // 统一下单API地址
    const unifiedOrderUrl = 'https://api.mch.weixin.qq.com/pay/unifiedorder';
    
    console.log(`正在发送微信支付统一下单请求, 订单号: ${orderData.orderNumber}`);
    
    // 发送请求到微信支付API
    const response = await axios.post(unifiedOrderUrl, xmlData, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 10000 // 10秒超时
    });
    
    // 解析响应XML
    const result = parseXML(response.data);
    console.log('微信支付返回结果:', JSON.stringify(result));
    
    // 检查返回结果
    if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
      console.log(`微信支付统一下单成功, 订单号: ${orderData.orderNumber}, 二维码URL已生成`);
      return {
        success: true,
        codeUrl: result.code_url,
        orderNumber: orderData.orderNumber,
        amount: orderData.amount,
        timestamp: Math.floor(Date.now() / 1000),
        nonceStr: params.nonce_str
      };
    } else {
      // 错误信息
      let errorMsg = '未知错误';
      
      if (result.return_code === 'FAIL') {
        errorMsg = `通信失败: ${result.return_msg}`;
      } else if (result.result_code === 'FAIL') {
        errorMsg = `业务失败: ${result.err_code_des || result.err_code}`;
      }
      
      // 特殊处理订单号重复错误
      if (result.err_code === 'INVALID_REQUEST' && result.err_code_des && result.err_code_des.includes('商户订单号重复')) {
        console.error(`微信支付业务失败 - 订单号重复 [${orderData.orderNumber}]: ${result.err_code} ${result.err_code_des}`);
        console.log(`订单号: [${orderData.orderNumber}], 金额: ${orderData.amount}元, 完整响应结果: ${JSON.stringify(result)}`);
        
        // 尝试再次查询订单状态
        try {
          console.log(`订单号重复 [${orderData.orderNumber}], 尝试查询该订单的状态`);
          const duplicateOrderStatus = await queryOrderStatus(orderData.orderNumber);
          
          console.log(`查询重复订单 [${orderData.orderNumber}] 结果:`, JSON.stringify(duplicateOrderStatus));
          
          if (duplicateOrderStatus.success) {
            console.log(`成功查询到重复订单 [${orderData.orderNumber}] 状态:`, JSON.stringify(duplicateOrderStatus));
            
            // 如果订单已支付，返回支付成功状态
            if (duplicateOrderStatus.isPaid) {
              console.log(`订单 [${orderData.orderNumber}] 已支付完成，直接返回已支付状态`);
              return {
                success: true,
                isPaid: true,
                orderNumber: orderData.orderNumber,
                amount: orderData.amount,
                message: '订单已支付'
              };
            }
            
            // 如果订单已经在微信支付系统中，且有二维码，则直接使用
            if (duplicateOrderStatus.codeUrl) {
              console.log(`使用订单 [${orderData.orderNumber}] 已存在的支付二维码URL`);
              return {
                success: true,
                codeUrl: duplicateOrderStatus.codeUrl,
                orderNumber: orderData.orderNumber,
                amount: orderData.amount,
                timestamp: Math.floor(Date.now() / 1000),
                nonceStr: params.nonce_str,
                message: '使用已存在的支付二维码'
              };
            }
            
            // 如果订单未支付但也没有二维码，尝试关闭旧订单并返回错误
            try {
              console.log(`尝试关闭旧订单 [${orderData.orderNumber}]`);
              const closeResult = await closeOrder(orderData.orderNumber);
              console.log(`关闭旧订单 [${orderData.orderNumber}] 结果:`, JSON.stringify(closeResult));
              
              if (closeResult.success) {
                console.log(`成功关闭旧订单 [${orderData.orderNumber}], 建议创建新订单`);
                return {
                  success: false,
                  message: `订单号重复，已成功关闭旧订单，请创建新订单`,
                  needRetry: true,
                  error: result,
                  duplicateStatus: duplicateOrderStatus
                };
              } else {
                console.error(`关闭旧订单 [${orderData.orderNumber}] 失败:`, closeResult);
                return {
                  success: false,
                  message: `订单号重复且无法关闭旧订单: ${result.err_code_des}`,
                  needRetry: true,
                  error: result,
                  closeError: closeResult
                };
              }
            } catch (closeError) {
              console.error(`关闭旧订单 [${orderData.orderNumber}] 发生异常:`, closeError);
              return {
                success: false,
                message: `订单号重复且关闭旧订单时出错: ${closeError.message || result.err_code_des}`,
                needRetry: true,
                error: result,
                closeError
              };
            }
          }
          
          // 返回错误和查询状态结果
          console.log(`无法完整查询到订单 [${orderData.orderNumber}] 状态, 建议创建新订单`);
          return {
            success: false,
            message: `订单号重复但状态未知: ${result.err_code_des}`,
            error: result,
            duplicateStatus: duplicateOrderStatus,
            needRetry: true
          };
        } catch (statusError) {
          console.error(`尝试查询重复订单 [${orderData.orderNumber}] 状态失败:`, statusError);
          return {
            success: false,
            message: `订单号重复且无法查询状态: ${result.err_code_des}`,
            error: result,
            statusError,
            needRetry: true
          };
        }
      }
      
      console.error(`微信支付失败, 订单号: ${orderData.orderNumber}, 错误: ${errorMsg}`);
      return {
        success: false,
        message: errorMsg,
        error: result
      };
    }
  } catch (error) {
    console.error('微信支付请求失败:', error);
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
  try {
    console.log('开始验证微信支付回调签名...');
    
    // 提取微信返回的签名
    const wxSign = notifyData.sign;
    if (!wxSign) {
      console.error('回调数据中没有签名字段');
      return false;
    }
    
    // 删除签名字段，重新计算签名
    const dataForSign = { ...notifyData };
    delete dataForSign.sign;
    
    // 生成我方签名
    const sign = generateSign(dataForSign);
    
    console.log('微信签名:', wxSign);
    console.log('本地签名:', sign);
    
    // 比较签名是否一致
    const isValid = sign === wxSign;
    console.log('签名验证结果:', isValid ? '验证通过' : '验证失败');
    
    return isValid;
  } catch (error) {
    console.error('验证签名时发生错误:', error);
    return false;
  }
}

/**
 * 查询订单状态
 * @param {string} orderNumber 订单号
 * @returns {Promise<Object>} 订单状态
 */
export async function queryOrderStatus(orderNumber) {
  try {
    console.log('查询订单状态:', orderNumber);
    
    // 先尝试从本地数据库获取订单信息
    const localOrder = await getLocalOrder(orderNumber);
    
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
    
    // 订单查询API地址
    const orderQueryUrl = 'https://api.mch.weixin.qq.com/pay/orderquery';
    
    // 发送请求到微信支付API
    const response = await axios.post(orderQueryUrl, xmlData, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 10000 // 10秒超时
    });
    
    // 解析响应XML
    const result = parseXML(response.data);
    console.log('查询订单结果:', JSON.stringify(result));
    
    // 检查返回结果
    if (result.return_code === 'SUCCESS') {
      if (result.result_code === 'SUCCESS') {
        // 订单存在，判断是否已支付
        const isPaid = result.trade_state === 'SUCCESS';
        const orderResult = {
          success: true,
          status: result.trade_state,
          isPaid: isPaid,
          exists: true,
          transactionId: result.transaction_id || '',
          orderNumber: result.out_trade_no,
          amount: parseInt(result.total_fee || '0') / 100,
          timeEnd: result.time_end || ''
        };
        
        // 如果有本地存储的二维码URL，添加到结果中
        if (localOrder && localOrder.metadata && localOrder.metadata.codeUrl) {
          console.log(`从本地订单记录找到了二维码URL: ${localOrder.metadata.codeUrl}`);
          orderResult.codeUrl = localOrder.metadata.codeUrl;
        } else {
          console.log(`本地订单记录没有存储二维码URL`);
        }
        
        return orderResult;
      } else {
        // 订单不存在判断
        const notExist = result.err_code === 'ORDERNOTEXIST';
        console.log(`订单状态查询失败, 订单号: ${orderNumber}, 错误码: ${result.err_code}, 存在状态: ${!notExist}`);
        
        // 即使订单不存在于微信支付系统，但如果本地有记录且有二维码URL，也可以返回
        if (notExist && localOrder && localOrder.metadata && localOrder.metadata.codeUrl) {
          console.log(`微信支付系统中不存在订单，但本地有二维码URL，标记为不存在但返回二维码URL`);
          return {
            success: false,
            message: result.err_code_des || '订单查询失败',
            error: result,
            exists: false,
            codeUrl: localOrder.metadata.codeUrl
          };
        }
        
        return {
          success: false,
          message: result.err_code_des || '订单查询失败',
          error: result,
          exists: !notExist // 如果错误是订单不存在，则标记为不存在
        };
      }
    } else {
      console.error(`查询订单通信失败: ${result.return_msg}`);
      
      // 通信失败但本地有记录，依然可以继续使用本地的二维码
      if (localOrder && localOrder.metadata && localOrder.metadata.codeUrl) {
        console.log(`微信支付通信失败，但本地有二维码URL，返回本地URL`);
        return {
          success: false,
          message: result.return_msg || '通信失败',
          error: result,
          exists: false,
          codeUrl: localOrder.metadata.codeUrl
        };
      }
      
      return {
        success: false,
        message: result.return_msg || '通信失败',
        error: result,
        exists: false
      };
    }
  } catch (error) {
    console.error('查询订单状态失败:', error);
    
    // 即使查询失败，依然尝试从本地获取订单信息
    try {
      const localOrder = await getLocalOrder(orderNumber);
      if (localOrder && localOrder.metadata && localOrder.metadata.codeUrl) {
        console.log(`查询订单状态出错，但找到了本地存储的二维码URL，返回本地URL`);
        return {
          success: false,
          message: error.message || '查询订单失败',
          error: error.toString(),
          exists: false,
          codeUrl: localOrder.metadata.codeUrl
        };
      }
    } catch (localError) {
      console.error('获取本地订单信息也失败:', localError);
    }
    
    return {
      success: false,
      message: error.message || '查询订单失败',
      error: error.toString(),
      exists: false
    };
  }
}

/**
 * 从本地数据库获取订单信息（这个函数需要在前端调用时才实现）
 * @param {string} orderNumber 订单号
 * @returns {Promise<Object>} 订单信息
 */
// 订单查询函数，默认为空实现，需要被外部设置
let orderProviderFn = async (orderNumber) => {
  console.log('未设置订单查询函数，无法获取订单:', orderNumber);
  return null;
};

/**
 * 设置订单查询提供者函数
 * @param {Function} providerFn 查询函数，接收orderNumber参数，返回订单信息
 */
export function setOrderProvider(providerFn) {
  if (typeof providerFn === 'function') {
    orderProviderFn = providerFn;
    console.log('已设置订单查询函数');
  } else {
    console.error('设置订单查询函数失败: 提供的不是函数');
  }
}

/**
 * 从本地数据库获取订单信息
 * @param {string} orderNumber 订单号
 * @returns {Promise<Object>} 订单信息
 */
async function getLocalOrder(orderNumber) {
  try {
    console.log(`尝试从本地数据库获取订单信息: ${orderNumber}`);
    const order = await orderProviderFn(orderNumber);
    
    if (!order) {
      console.log(`未找到订单: ${orderNumber}`);
      return null;
    }
    
    console.log(`成功获取订单信息 ${orderNumber}, 检查metadata:`, 
      order.metadata ? '存在metadata' : '无metadata',
      order.metadata?.codeUrl ? `包含codeUrl: ${order.metadata.codeUrl.substring(0, 30)}...` : '不包含codeUrl'
    );
    
    return order;
  } catch (error) {
    console.error(`获取本地订单信息错误:`, error);
    return null;
  }
}

/**
 * 关闭订单
 * @param {string} orderNumber 订单号
 * @returns {Promise<Object>} 关闭结果
 */
export async function closeOrder(orderNumber) {
  try {
    console.log('关闭订单:', orderNumber);
    
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
    
    // 关闭订单API地址
    const closeOrderUrl = 'https://api.mch.weixin.qq.com/pay/closeorder';
    
    // 发送请求到微信支付API
    const response = await axios.post(closeOrderUrl, xmlData, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 10000 // 10秒超时
    });
    
    // 解析响应XML
    const result = parseXML(response.data);
    console.log('关闭订单结果:', JSON.stringify(result));
    
    // 检查返回结果
    if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
      return {
        success: true,
        orderNumber: orderNumber
      };
    } else {
      return {
        success: false,
        message: result.return_msg || result.err_code_des || '关闭订单失败',
        error: result
      };
    }
  } catch (error) {
    console.error('关闭订单失败:', error);
    return {
      success: false,
      message: error.message || '关闭订单失败',
      error: error.toString()
    };
  }
} 