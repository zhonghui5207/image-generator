import express from 'express';
import GeneratedImage from '../models/GeneratedImage.js';
import { authenticate } from '../utils/auth.js';
import { deleteFromOSS, checkOssConfig } from '../utils/ossClient.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = express.Router();

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 检查OSS配置
const useOSS = checkOssConfig();
console.log(`ImageHistoryRoutes - OSS存储状态: ${useOSS ? '已启用' : '未启用，将使用本地存储'}`);

// 获取用户的图像生成历史
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const images = await GeneratedImage.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await GeneratedImage.countDocuments({ user: req.user._id });
    
    res.json({
      success: true,
      images,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取图像历史错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取单个图像详情
router.get('/:id', authenticate, async (req, res) => {
  try {
    const image = await GeneratedImage.findOne({
      _id: req.params.id,
      user: req.user._id
    });
    
    if (!image) {
      return res.status(404).json({ success: false, message: '图像不存在' });
    }
    
    res.json({
      success: true,
      image
    });
  } catch (error) {
    console.error('获取图像详情错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 从URL或本地路径中提取OSS路径
function extractOSSPath(url) {
  if (!url || !url.startsWith('http')) {
    return null;
  }
  
  // 提取路径部分
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/');
  
  // 检查是否包含特定的文件夹名称
  const folderPatterns = ['kdy-uploads', 'kdy-generated', 'uploads', 'generated'];
  let folderName = null;
  
  for (const pattern of folderPatterns) {
    const foundPart = pathParts.find(part => part === pattern);
    if (foundPart) {
      folderName = foundPart;
      break;
    }
  }
  
  if (!folderName) {
    return null;
  }
  
  // 构建OSS路径 (kdy-uploads/filename 或 kdy-generated/filename)
  const folderIndex = pathParts.indexOf(folderName);
  if (folderIndex >= 0 && folderIndex < pathParts.length - 1) {
    return `${folderName}/${pathParts[folderIndex + 1]}`;
  }
  
  return null;
}

// 删除图像历史记录
router.delete('/:id', authenticate, async (req, res) => {
  try {
    // 先查找图像记录，以便获取图片路径
    const image = await GeneratedImage.findOne({
      _id: req.params.id,
      user: req.user._id
    });
    
    if (!image) {
      return res.status(404).json({ success: false, message: '图像不存在' });
    }
    
    // 准备删除操作的日志
    const deleteOperations = [];
    
    // 如果启用了OSS，尝试删除OSS中的图片
    if (useOSS) {
      // 处理生成的图片
      if (image.generatedImage && image.generatedImage.startsWith('http')) {
        const generatedOssPath = extractOSSPath(image.generatedImage);
        if (generatedOssPath) {
          try {
            await deleteFromOSS(generatedOssPath);
            deleteOperations.push(`已从OSS删除生成图片: ${generatedOssPath}`);
          } catch (ossError) {
            console.error(`删除OSS生成图片失败: ${generatedOssPath}`, ossError);
            deleteOperations.push(`删除OSS生成图片失败: ${generatedOssPath}`);
          }
        }
      }
      
      // 处理原始图片（如果有）
      if (image.originalImage && image.originalImage.startsWith('http')) {
        const originalOssPath = extractOSSPath(image.originalImage);
        if (originalOssPath) {
          try {
            await deleteFromOSS(originalOssPath);
            deleteOperations.push(`已从OSS删除原始图片: ${originalOssPath}`);
          } catch (ossError) {
            console.error(`删除OSS原始图片失败: ${originalOssPath}`, ossError);
            deleteOperations.push(`删除OSS原始图片失败: ${originalOssPath}`);
          }
        }
      }
    } else {
      // 处理本地文件系统的图片
      // 处理生成的图片
      if (image.generatedImage && !image.generatedImage.startsWith('http')) {
        const localPath = path.join(__dirname, '..', image.generatedImage.replace(/^\//, ''));
        try {
          if (fs.existsSync(localPath)) {
            fs.unlinkSync(localPath);
            deleteOperations.push(`已删除本地生成图片: ${localPath}`);
          }
        } catch (fsError) {
          console.error(`删除本地生成图片失败: ${localPath}`, fsError);
          deleteOperations.push(`删除本地生成图片失败: ${localPath}`);
        }
      }
      
      // 处理原始图片（如果有）
      if (image.originalImage && !image.originalImage.startsWith('http')) {
        const localPath = path.join(__dirname, '..', image.originalImage.replace(/^\//, ''));
        try {
          if (fs.existsSync(localPath)) {
            fs.unlinkSync(localPath);
            deleteOperations.push(`已删除本地原始图片: ${localPath}`);
          }
        } catch (fsError) {
          console.error(`删除本地原始图片失败: ${localPath}`, fsError);
          deleteOperations.push(`删除本地原始图片失败: ${localPath}`);
        }
      }
    }
    
    // 删除数据库记录
    const result = await GeneratedImage.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });
    
    res.json({
      success: true,
      message: '图像历史记录已删除',
      operations: deleteOperations
    });
  } catch (error) {
    console.error('删除图像历史错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

export default router;
