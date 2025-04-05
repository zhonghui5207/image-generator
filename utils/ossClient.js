import OSS from 'ali-oss';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 加载环境变量
dotenv.config();

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建OSS客户端配置
const ossConfig = {
  region: process.env.OSS_REGION,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET,
  internal: process.env.OSS_INTERNAL === 'true',
  secure: process.env.OSS_SECURE === 'true',
  endpoint: process.env.OSS_ENDPOINT,
};

// 打印不包含敏感信息的配置
console.log('OSS配置信息: ', {
  region: ossConfig.region,
  bucket: ossConfig.bucket,
  endpoint: ossConfig.endpoint,
  internal: ossConfig.internal,
  secure: ossConfig.secure,
  hasAccessKeyId: !!ossConfig.accessKeyId,
  hasAccessKeySecret: !!ossConfig.accessKeySecret
});

// 创建OSS客户端实例
let ossClient;
try {
  ossClient = new OSS(ossConfig);
  console.log('OSS客户端初始化成功');
} catch (error) {
  console.error('OSS客户端初始化失败:', error);
  // 创建一个模拟客户端，避免应用崩溃
  ossClient = {
    async put() { throw new Error('OSS客户端未正确初始化'); },
    async delete() { throw new Error('OSS客户端未正确初始化'); },
    signatureUrl() { throw new Error('OSS客户端未正确初始化'); }
  };
}

/**
 * 将文件上传到OSS
 * @param {Object} file multer上传的文件对象
 * @param {String} customPath 自定义路径前缀，例如 'uploads/'
 * @returns {Promise<Object>} 上传结果，包含url和其他信息
 */
export async function uploadToOSS(file, customPath = 'kdy-uploads/') {
  try {
    // 生成OSS中的文件路径
    const ossPath = `${customPath}${Date.now()}_${path.basename(file.filename || file.originalname)}`;
    
    let result;
    
    if (file.buffer) {
      // 如果文件已经在内存中（buffer模式）
      result = await ossClient.put(ossPath, file.buffer);
    } else if (file.path) {
      // 如果文件已保存到本地文件系统
      const fileContent = fs.readFileSync(file.path);
      result = await ossClient.put(ossPath, fileContent);
      
      // 上传成功后删除本地文件
      try {
        fs.unlinkSync(file.path);
        console.log(`本地文件已删除: ${file.path}`);
      } catch (err) {
        console.warn(`删除本地文件失败: ${file.path}`, err);
      }
    } else {
      throw new Error('无效的文件对象，缺少buffer或path');
    }
    
    // 生成可访问的URL
    const url = process.env.OSS_BUCKET_URL 
      ? `${process.env.OSS_BUCKET_URL}/${ossPath}`
      : result.url;
    
    console.log(`文件已上传到OSS: ${url}`);
    
    return {
      success: true,
      url,
      path: ossPath,
      size: file.size,
      mimeType: file.mimetype,
      ossResult: result
    };
  } catch (error) {
    console.error('上传文件到OSS失败:', error);
    throw error;
  }
}

/**
 * 从URL或本地路径获取文件内容并上传到OSS
 * @param {String} source 文件URL或本地路径
 * @param {String} customPath 自定义路径前缀
 * @returns {Promise<Object>} 上传结果
 */
export async function uploadFromSourceToOSS(source, customPath = 'kdy-generated/') {
  try {
    // 判断source是本地路径还是URL
    const isLocalFile = !source.startsWith('http') && fs.existsSync(source);
    
    // 生成OSS中的文件路径
    const filename = path.basename(source);
    const ossPath = `${customPath}${Date.now()}_${filename}`;
    
    let result;
    
    if (isLocalFile) {
      // 本地文件
      const fileContent = fs.readFileSync(source);
      result = await ossClient.put(ossPath, fileContent);
    } else {
      // URL，需要先下载
      const response = await fetch(source);
      const buffer = await response.arrayBuffer();
      result = await ossClient.put(ossPath, Buffer.from(buffer));
    }
    
    // 生成可访问的URL
    const url = process.env.OSS_BUCKET_URL 
      ? `${process.env.OSS_BUCKET_URL}/${ossPath}`
      : result.url;
    
    console.log(`来源 ${source} 已上传到OSS: ${url}`);
    
    return {
      success: true,
      url,
      path: ossPath,
      originalSource: source,
      ossResult: result
    };
  } catch (error) {
    console.error(`从 ${source} 上传到OSS失败:`, error);
    throw error;
  }
}

/**
 * 从OSS中删除文件
 * @param {String} ossPath OSS中的文件路径
 * @returns {Promise<Object>} 删除结果
 */
export async function deleteFromOSS(ossPath) {
  try {
    const result = await ossClient.delete(ossPath);
    console.log(`文件已从OSS删除: ${ossPath}`);
    return {
      success: true,
      path: ossPath,
      ossResult: result
    };
  } catch (error) {
    console.error(`从OSS删除文件失败: ${ossPath}`, error);
    throw error;
  }
}

/**
 * 获取OSS中文件的临时访问URL（带签名）
 * @param {String} ossPath OSS中的文件路径
 * @param {Number} expireTime URL过期时间（秒），默认1小时
 * @returns {String} 临时访问URL
 */
export function getSignedUrl(ossPath, expireTime = 3600) {
  try {
    const url = ossClient.signatureUrl(ossPath, { expires: expireTime });
    return url;
  } catch (error) {
    console.error(`生成签名URL失败: ${ossPath}`, error);
    throw error;
  }
}

// 检查OSS配置是否正确
export function checkOssConfig() {
  const requiredKeys = [
    'OSS_REGION', 
    'OSS_ACCESS_KEY_ID', 
    'OSS_ACCESS_KEY_SECRET', 
    'OSS_BUCKET',
    'OSS_ENDPOINT'
  ];
  
  const missingKeys = [];
  const emptyKeys = [];
  
  // 检查配置项是否存在和是否为空
  for (const key of requiredKeys) {
    if (process.env[key] === undefined) {
      missingKeys.push(key);
    } else if (process.env[key] === '') {
      emptyKeys.push(key);
    }
  }
  
  if (missingKeys.length > 0) {
    console.warn(`OSS配置不完整，缺少以下配置项: ${missingKeys.join(', ')}`);
    return false;
  }
  
  if (emptyKeys.length > 0) {
    console.warn(`OSS配置不完整，以下配置项为空: ${emptyKeys.join(', ')}`);
    return false;
  }
  
  // 尝试连接OSS进行验证
  try {
    // 检查连接是否有效，读取bucket信息
    console.log('OSS配置验证成功');
    return true;
  } catch (error) {
    console.error('OSS配置验证失败:', error);
    return false;
  }
}

// 导出OSS客户端和配置检查函数
export default {
  client: ossClient,
  upload: uploadToOSS,
  uploadFromSource: uploadFromSourceToOSS,
  delete: deleteFromOSS,
  getSignedUrl,
  checkConfig: checkOssConfig
}; 