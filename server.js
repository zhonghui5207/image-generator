import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import mongoose from './models/db.js';
import ossClient, { uploadToOSS, uploadFromSourceToOSS, checkOssConfig } from './utils/ossClient.js';
import OSS from 'ali-oss';
// 兼容性导入fetch
import fetch from 'node-fetch';

// 导入路由
import authRoutes from './routes/authRoutes.js';
import creditRoutes from './routes/creditRoutes.js';
import imageHistoryRoutes from './routes/imageHistoryRoutes.js';
import smsRoutes from './routes/smsRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

// 导入中间件和工具
import { authenticate, checkCredits } from './utils/auth.js';
import { useCredits } from './routes/creditRoutes.js';
import GeneratedImage from './models/GeneratedImage.js';
import User from './models/User.js';

// Load environment variables
dotenv.config();

// Set up __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// 添加中间件
app.use(cookieParser()); // 解析cookie

// 检查OSS配置
const useOSS = checkOssConfig();
console.log(`OSS存储状态: ${useOSS ? '已启用' : '未启用，将使用本地存储'}`);
console.log('OSS配置检查详情:', process.env.OSS_ACCESS_KEY_ID ? '配置存在' : '配置缺失');

// 强制使用OSS (如果配置存在)
const forceUseOSS = process.env.OSS_ACCESS_KEY_ID && process.env.OSS_ACCESS_KEY_SECRET && process.env.OSS_BUCKET;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

// 如果使用OSS，可以使用内存存储
const memoryStorage = multer.memoryStorage();

// 根据是否使用OSS选择存储方式
const upload = multer({ 
  storage: forceUseOSS ? memoryStorage : storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// OSS文件处理中间件
async function processFileWithOSS(req, res, next) {
  console.log('进入OSS处理中间件, 文件存在:', !!req.file);
  
  if (!forceUseOSS) {
    console.log('OSS未启用或配置不完整，使用本地存储');
    return next();
  }
  
  if (!req.file) {
    console.log('文件不存在，跳过OSS处理');
    return next();
  }
  
  try {
    console.log(`处理文件上传到OSS: ${req.file.originalname}, 文件类型: ${req.file.mimetype}, 文件大小: ${req.file.size} 字节`);
    console.log(`文件使用${req.file.buffer ? '内存存储' : '磁盘存储'}`);
    
    // 处理内存中的文件，上传到OSS
    const uploadResult = await uploadToOSS(req.file, 'kdy-uploads/');
    
    // 保存OSS文件URL到请求对象中
    req.file.originalPath = req.file.path; // 保存可能的本地路径
    req.file.path = uploadResult.url; // 更新为OSS URL
    req.file.ossPath = uploadResult.path; // 保存OSS路径
    req.file.isOSS = true;
    
    console.log(`文件已成功上传到OSS: ${uploadResult.url}, 路径: ${uploadResult.path}`);
    
    next();
  } catch (error) {
    console.error('OSS处理文件失败:', error);
    
    // 输出更详细的错误信息
    if (error.code) console.error('错误代码:', error.code);
    if (error.name) console.error('错误名称:', error.name);
    if (error.status) console.error('错误状态:', error.status);
    
    // 如果OSS上传失败，但我们使用的是内存存储，需要保存到本地
    if (req.file.buffer) {
      const filename = Date.now() + path.extname(req.file.originalname);
      const uploadDir = path.join(__dirname, 'uploads');
      const filePath = path.join(uploadDir, filename);
      
      try {
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        fs.writeFileSync(filePath, req.file.buffer);
        req.file.path = filePath;
        req.file.isOSS = false;
        
        console.log(`OSS上传失败，已保存到本地: ${filePath}`);
        next();
      } catch (fsError) {
        console.error('保存文件到本地失败:', fsError);
        return res.status(500).json({ error: '文件处理失败', details: fsError.message });
      }
    } else {
      return res.status(500).json({ error: '文件上传到OSS失败', details: error.message });
    }
  }
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json());

// 允许的来源域名列表
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://kdy-imagic.lovexstory.com',  // 新域名
  'https://kdy-magic.kdua.top',  // 备案域名
  'https://kdy-magic.lovexstory.cn'
];

// CORS中间件
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// 注册API路由
app.use('/api/auth', authRoutes);
app.use('/api/credits', creditRoutes);
app.use('/api/history', imageHistoryRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);

// Helper function to convert image to base64
function image2Base64(imagePath) {
  // 检查是否为URL（OSS路径）
  if (imagePath.startsWith('http')) {
    // 从URL获取图像内容
    return new Promise(async (resolve, reject) => {
      try {
        console.log(`从URL获取图像: ${imagePath.substring(0, 100)}...`);
        const response = await fetch(imagePath, {
          timeout: 30000, // 30秒超时
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP错误，状态: ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        console.log(`图像获取成功，大小: ${buffer.length} 字节`);
        resolve(buffer.toString('base64'));
      } catch (error) {
        console.error('从URL获取图像失败:', error);
        reject(error);
      }
    });
  }
  
  // 本地文件路径
  try {
    console.log(`从本地路径读取图像: ${imagePath}`);
    const image = fs.readFileSync(imagePath);
    console.log(`图像读取成功，大小: ${image.length} 字节`);
    return image.toString('base64');
  } catch (error) {
    console.error(`读取本地图像失败: ${imagePath}`, error);
    throw error;
  }
}

// API endpoint for image generation
app.post('/api/generate-image', authenticate, checkCredits, upload.single('image'), processFileWithOSS, async (req, res) => {
  // 声明一些可能在错误处理中使用的变量
  let imagePath = null;
  let imageType = null;
  let originalImagePath = null;
  let mode = 'unknown';
  let selectedModel = process.env.OPENAI_MODEL || 'unknown';
  let prompt = '';
  let creditsToUse = 1;
  let tempImageHistory = null;
  
  // 设置错误处理函数以确保统一处理所有错误
  const handleError = async (error, statusCode = 500, errorMessage = 'Error processing image') => {
    console.error(`[${new Date().toISOString()}] Image generation error:`, error);
    
    // 检查是否请求流式响应
    const useStream = req.query.stream === 'true';
    
    try {
      // 生成失败时只扣除1积分
      const failureCreditsToUse = 1;
      
      // 设置一个有效的生成图像URL，即使是占位符
      // 安全地使用originalImagePath变量
      const placeholderImage = originalImagePath || 'https://placehold.co/600x400?text=生成失败';
      
      // 保存失败记录
      let failedImage;
      let newCreditBalance;
      
      // 检查是否存在临时历史记录（流式响应中可能已创建）
      if (typeof tempImageHistory !== 'undefined' && tempImageHistory) {
        // 更新临时历史记录以反映错误
        tempImageHistory.status = 'failed';
        tempImageHistory.errorMessage = errorMessage;
        tempImageHistory.generatedImage = placeholderImage;
        tempImageHistory.creditsUsed = failureCreditsToUse;
        
        await tempImageHistory.save().catch(err => {
          console.error('更新失败历史记录错误:', err);
        });
        
        failedImage = tempImageHistory;
      } else {
        // 如果临时历史记录不存在，创建一个新的失败记录
        const failedImageData = {
          user: req.user._id,
          generatedImage: placeholderImage,
          prompt: prompt || '未知提示词',
          model: selectedModel || process.env.OPENAI_MODEL || 'unknown',
          creditsUsed: failureCreditsToUse,
          mode: mode || 'unknown',
          status: 'failed',
          errorMessage: errorMessage
        };
        
        // 如果是图生图模式且有原始图像，添加原始图像
        if (mode === 'image-to-image' && originalImagePath) {
          failedImageData.originalImage = originalImagePath;
        }
        
        // 保存失败记录
        failedImage = new GeneratedImage(failedImageData);
        await failedImage.save().catch(err => {
          console.error('保存失败历史记录错误:', err);
        });
      }
      
      // 扣除1积分
      newCreditBalance = await useCredits(
        req.user._id,
        failureCreditsToUse,
        `生成图像失败 (${selectedModel || 'unknown'}) - ${errorMessage}`,
        failedImage?._id
      ).catch(err => {
        console.error('扣除积分错误:', err);
        return req.user.credits - failureCreditsToUse; // 如果扣积分失败，估算新余额
      });
      
      // 准备错误响应内容
      const errorResponseContent = {
        message: errorMessage,
        details: error.message || 'Unknown error',
        generationFailed: true,
        requiredCredits: creditsToUse || 1,
        currentCredits: req.user?.credits || 0,
        creditsNeeded: Math.max(0, (creditsToUse || 1) - (req.user?.credits || 0)),
        credits: {
          used: failureCreditsToUse,
          remaining: newCreditBalance
        }
      };
      
      // 检查headers是否已经发送
      if (res.headersSent) {
        console.warn('Headers already sent, cannot send full error response');
        if (useStream && !res.finished) {
          try {
            // 尝试发送错误事件并结束流
            res.write(`data: ${JSON.stringify({
              type: 'error',
              content: errorResponseContent
            })}\n\n`);
            res.end();
          } catch (endError) {
            console.error('Error ending stream:', endError);
          }
        }
        return;
      }
      
      // 根据响应类型返回错误
      if (useStream) {
        try {
          // 设置流式响应的HTTP头
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          });
          
          // 发送错误事件
          res.write(`data: ${JSON.stringify({
            type: 'error',
            content: errorResponseContent
          })}\n\n`);
          
          // 结束流
          res.end();
        } catch (streamError) {
          console.error('Error sending stream error:', streamError);
          // 如果流式响应失败，尝试发送普通JSON响应
          if (!res.headersSent) {
            res.status(statusCode).json({ 
              error: errorMessage, 
              details: error.message || 'Unknown error',
              credits: errorResponseContent.credits,
              generationFailed: true
            });
          }
        }
      } else {
        // 普通JSON响应
        res.status(statusCode).json({ 
          error: errorMessage, 
          details: error.message || 'Unknown error',
          credits: errorResponseContent.credits,
          generationFailed: true
        });
      }
    } catch (creditError) {
      console.error('处理API错误时积分处理失败:', creditError);
      
      // 只在尚未发送响应时发送错误响应
      if (!res.headersSent) {
        if (useStream) {
          try {
            // 设置流式响应的HTTP头
            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive'
            });
            
            // 发送错误事件
            res.write(`data: ${JSON.stringify({
              type: 'error',
              content: {
                message: `${errorMessage} (积分处理失败)`,
                details: error.message || 'Unknown error',
                generationFailed: true
              }
            })}\n\n`);
            
            // 结束流
            res.end();
          } catch (streamError) {
            console.error('Error sending stream credit error:', streamError);
            res.status(statusCode).json({ 
              error: `${errorMessage} (积分处理失败)`, 
              details: error.message || 'Unknown error',
              generationFailed: true
            });
          }
        } else {
          res.status(statusCode).json({ 
            error: `${errorMessage} (积分处理失败)`, 
            details: error.message || 'Unknown error',
            generationFailed: true
          });
        }
      }
    }
  };
  
  try {
    // 获取生成模式
    mode = req.body.mode || 'image-to-image';
    
    // 检查图生图模式是否需要图片
    if (mode === 'image-to-image' && !req.file) {
      return res.status(400).json({ error: '图生图模式需要上传图片' });
    }

    prompt = req.body.prompt || 'Transform this image into a creative style';
    
    // 只有图生图模式才处理图片
    if (mode === 'image-to-image' && req.file) {
      imagePath = req.file.path;
      imageType = path.extname(req.file.originalname).substring(1);
      
      // 将原始图像路径保存（OSS URL或本地路径）
      if (req.file.isOSS) {
        // 如果是OSS，直接使用URL
        originalImagePath = imagePath;
        console.log('使用OSS图片路径:', imagePath);
      } else {
        // 本地文件，检查是否为绝对路径
        if (imagePath.startsWith('/')) {
          // 已经是绝对路径，转换为相对路径
          originalImagePath = `/uploads/${path.basename(imagePath)}`;
        } else if (imagePath.startsWith('http')) {
          // 已经是URL
          originalImagePath = imagePath;
        } else {
          // 相对路径，保持不变
          originalImagePath = imagePath;
        }
        console.log('使用本地图片路径:', originalImagePath);
      }
    }
    
    // 获取所选模型，如果没有指定则使用环境变量中的默认值
    selectedModel = req.body.model || process.env.OPENAI_MODEL;
    console.log("Selected model:", selectedModel);
    
    // 确定消耗的积分数量
    switch (selectedModel) {
      case 'gpt-4-vision-preview':
        creditsToUse = 2; // 快速稳定出图，质量一般，DELL生图
        break;
      case 'gpt-4o-image':
        creditsToUse = 4; // 稳定性一般，质量好，出图慢，4o生图
        break;
      case 'gpt-4o-all':
        creditsToUse = 5; // 比较稳定，质量好，出图慢，4o生图
        break;
      case 'gpt-4o-image-vip':
        creditsToUse = 8; // 稳定性强，质量好，出图慢，4o生图
        break;
      default:
        creditsToUse = 2; // 默认使用最低积分
    }
    
    // 检查用户积分是否足够
    if (req.user.credits < creditsToUse) {
      // 返回状态码200和特殊标志，以便前端能够识别并正确处理
      return res.status(200).json({ 
        success: true, 
        insufficientCredits: true,
        message: '积分不足，请充值',
        currentCredits: req.user.credits,
        requiredCredits: creditsToUse,
        creditsNeeded: creditsToUse - req.user.credits,
        modelName: selectedModel
      });
    }

    // Initialize OpenAI client with more detailed configuration
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      timeout: 300000, // 5 minute timeout
      maxRetries: 5,   // Retry failed requests up to 5 times
      httpAgent: new https.Agent({ 
        keepAlive: true,
        timeout: 300000, // 5 minute socket timeout
        rejectUnauthorized: false // 如果有 SSL 证书问题，这会帮助解决
      })
    });
    
    // Verify API key format
    if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_API_KEY.startsWith('sk-')) {
      console.error('Warning: OpenAI API key may be invalid. It should start with "sk-"');
    }

    console.log("Starting image generation request");
    console.log("Using model:", selectedModel);
    console.log("API Base URL:", process.env.OPENAI_BASE_URL);
    console.log("Prompt:", prompt);
    console.log("Image path:", imagePath);
    console.log("Credits to use:", creditsToUse);
    
    // 使用 OpenAI 的 API 进行图像生成
    try {
      console.log("Preparing API request...");
      
      // 检查是否请求流式响应
      const useStream = req.query.stream === 'true';
      
      if (useStream) {
        console.log(`[${new Date().toISOString()}] 使用流式响应，准备生成`);
        
        // 设置流式响应的HTTP头
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });
        
        // 发送初始信息
        if (originalImagePath) {
          res.write(`data: ${JSON.stringify({
            type: 'info',
            content: {
              originalImage: originalImagePath
            }
          })}\n\n`);
        }
        
        // 创建一个临时的历史记录，记录用户请求信息
        // 这个记录会在收到API响应后更新
        const tempImageHistory = new GeneratedImage({
          user: req.user._id,
          prompt: prompt,
          model: selectedModel,
          status: 'processing',
          mode: mode,
          originalImage: mode === 'image-to-image' ? originalImagePath : undefined,
          // 设置一个临时URL，这将在后续更新
          generatedImage: originalImagePath || 'pending'
        });
        
        // 保存临时历史记录
        await tempImageHistory.save().catch(err => {
          console.error('保存临时历史记录失败:', err);
        });
        
        // 创建流式请求
        try {
          const stream = await openai.chat.completions.create({
            model: selectedModel,
            messages: mode === 'image-to-image' ? [{
              role: 'user', 
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: imagePath.startsWith('http') 
                      ? `data:image/${imageType};base64,${await image2Base64(imagePath)}`
                      : `data:image/${imageType};base64,${image2Base64(imagePath)}`
                  }
                },
                {
                  type: "text",
                  text: prompt
                },
              ]
            }] : [{
              role: 'user',
              content: [
                {
                  type: "text",
                  text: `请根据以下描述生成一张图片：${prompt}`
                }
              ]
            }],
            stream: true,
            timeout: 300000  // 5分钟超时
          });
          
          // 收集完整响应内容（用于处理图像 URL 和历史记录）
          let fullContent = '';
          
          // 处理流式响应
          let chunkCount = 0;
          const startTime = Date.now();
          console.log(`[${new Date().toISOString()}] 开始接收流式数据`);
          
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            chunkCount++;
            
            if (content) {
              fullContent += content;
              
              // 将每个数据块发送给客户端
              res.write(`data: ${JSON.stringify({
                type: 'content',
                content: content
              })}\n\n`);
              
              // 每10个数据块打印一次进度
              if (chunkCount % 10 === 0) {
                const elapsedSeconds = (Date.now() - startTime) / 1000;
                console.log(`[${new Date().toISOString()}] 已接收 ${chunkCount} 个数据块，内容长度: ${fullContent.length}，已用时间: ${elapsedSeconds.toFixed(1)}秒`);
              }
            }
          }
          
          const totalTime = (Date.now() - startTime) / 1000;
          console.log(`[${new Date().toISOString()}] 流式响应完成，共接收 ${chunkCount} 个数据块，总内容长度: ${fullContent.length}，总用时: ${totalTime.toFixed(1)}秒`);
          
          // 处理图像 URL 提取和API返回的提示词
          let generatedImageUrl = '';
          let apiPrompt = '';
          let isGenerationFailed = false;
          
          console.log('处理图像 URL 提取，原始结果:', fullContent);
          
          // 尝试提取API返回的提示词
          const promptMatch = fullContent.match(/"prompt":\s*"([^"]+)"/i);
          if (promptMatch && promptMatch[1]) {
            apiPrompt = promptMatch[1];
            console.log('提取到API返回的提示词:', apiPrompt);
          }
          
          // 尝试匹配图像 URL
          let imgUrlMatch = fullContent.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/i);
          if (!imgUrlMatch) {
            imgUrlMatch = fullContent.match(/\[下载[^\]]*\]\((https?:\/\/[^\s)]+)\)/i);
          }
          if (!imgUrlMatch) {
            imgUrlMatch = fullContent.match(/(https?:\/\/oaiusercontent[^\s"'<>]+)/i);
          }
          
          if (imgUrlMatch && imgUrlMatch[1]) {
            generatedImageUrl = imgUrlMatch[1];
          } else if (imgUrlMatch && imgUrlMatch[0] && imgUrlMatch[0].startsWith('http')) {
            generatedImageUrl = imgUrlMatch[0];
          }
          
          if (!generatedImageUrl) {
            console.log('未找到图像 URL，使用原始图像作为占位');
            generatedImageUrl = originalImagePath || 'https://placehold.co/600x400?text=生成失败';
            isGenerationFailed = true; // 标记为生成失败
          } else if (useOSS && generatedImageUrl && generatedImageUrl.startsWith('http')) {
            // 检查URL是否是直接可用的图片格式
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
            const isDirectImageUrl = imageExtensions.some(ext => 
              generatedImageUrl.toLowerCase().endsWith(ext) || generatedImageUrl.toLowerCase().includes(`${ext}?`)
            );
            
            if (!isDirectImageUrl) {
              // 如果不是直接的图片URL，需要下载图片内容并上传到OSS
              try {
                console.log('将生成的图像从URL下载并上传到OSS:', generatedImageUrl);
                // 使用fetch直接下载图片内容
                const response = await fetch(generatedImageUrl, {
                  timeout: 30000,
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                  }
                });
                
                if (!response.ok) {
                  throw new Error(`下载图片失败，HTTP状态: ${response.status}`);
                }
                
                // 获取图片二进制数据
                const imageBuffer = Buffer.from(await response.arrayBuffer());
                
                // 生成文件名和OSS路径
                const ossPath = `kdy-generated/${Date.now()}_openai_image.jpg`;
                
                // 上传图片二进制内容到OSS
                const result = await ossClient.put(ossPath, imageBuffer);
                
                // 生成可访问的URL
                const url = process.env.OSS_BUCKET_URL 
                  ? `${process.env.OSS_BUCKET_URL}/${ossPath}`
                  : result.url;
                  
                generatedImageUrl = url;
                console.log('图像已下载并上传到OSS:', generatedImageUrl);
              } catch (ossError) {
                console.error('下载并上传生成图像到OSS失败，使用原始URL:', ossError);
                // 出错时保留原URL
              }
            } else {
              console.log('URL是直接的图片格式，不需要下载:', generatedImageUrl);
            }
          }
          
          // 扣除用户积分 - 根据生成结果调整积分消耗
          const actualCreditsToUse = isGenerationFailed ? 1 : creditsToUse; // 如果生成失败，只扣1积分
          
          const newCreditBalance = await useCredits(
            req.user._id, 
            actualCreditsToUse,  // 使用调整后的积分数量
            isGenerationFailed ? `生成图像失败 (${selectedModel})` : `生成图像 (${selectedModel})`, 
            tempImageHistory._id  // 使用临时历史记录的ID
          );
          
          // 更新生成历史记录
          tempImageHistory.generatedImage = generatedImageUrl;
          tempImageHistory.creditsUsed = actualCreditsToUse;
          tempImageHistory.status = isGenerationFailed ? 'failed' : 'success';
          tempImageHistory.errorMessage = isGenerationFailed ? '未能生成有效图像' : null;
          
          // 保存更新后的记录
          await tempImageHistory.save().catch(err => {
            console.error('更新历史记录失败:', err);
          });
          
          // 尝试翻译提示词（如果是英文）
          let translatedPrompt = null;
          let apiPromptToSend = apiPrompt || prompt; // 优先使用API返回的提示词
          
          if (apiPromptToSend && /[a-zA-Z]/.test(apiPromptToSend)) {
            try {
              // 这里可以调用翻译API，但为了简化，我们在前端处理翻译
              // translatedPrompt = await translateText(apiPromptToSend);
              translatedPrompt = apiPromptToSend; // 前端会处理翻译
            } catch (error) {
              console.error('翻译提示词时出错:', error);
            }
          }
          
          // 发送最终结果
          res.write(`data: ${JSON.stringify({
            type: 'result',
            content: {
              success: true,
              generatedImageUrl: generatedImageUrl,
              apiPrompt: apiPrompt, // 发送API返回的英文提示词
              userPrompt: prompt, // 发送用户输入的原始提示词
              translatedPrompt: translatedPrompt,
              generationFailed: isGenerationFailed, // 添加生成失败标记
              credits: {
                used: actualCreditsToUse, // 返回实际扣除的积分
                remaining: newCreditBalance
              },
              historyId: tempImageHistory._id  // 使用临时历史记录的ID
            }
          })}\n\n`);
          
          // 结束流式响应
          res.end();
          return;
        } catch (apiError) {
          // 使用统一的错误处理函数
          await handleError(apiError, 500, '流式响应API错误');
          return;
        }
      } else {
        // 非流式响应处理（原有方式）
        let messages = [];
        
        if (mode === 'image-to-image') {
          // 图生图模式：包含图片和提示词
          const imageBase64 = await image2Base64(imagePath);
          
          messages = [{
            role: 'user', 
            content: [
              {
                type: "image_url",
                image_url: {
                  url: imagePath.startsWith('http') 
                    ? `data:image/${imageType};base64,${imageBase64}`
                    : `data:image/${imageType};base64,${imageBase64}`
                }
              },
              {
                type: "text",
                text: prompt
              },
            ]
          }];
        } else {
          // 文生图模式：只包含提示词
          messages = [{
            role: 'user',
            content: [
              {
                type: "text",
                text: `请根据以下描述生成一张图片：${prompt}`
              }
            ]
          }];
        }
        
        const response = await openai.chat.completions.create({
          model: selectedModel,
          messages: messages,
          timeout: 300000  // 增加到 5 分钟超时
        });

        console.log("Chat API response received");
        console.log("Response structure:", JSON.stringify(Object.keys(response)));
        if (response.choices && response.choices.length > 0) {
          console.log("First choice:", JSON.stringify(response.choices[0]));
        } else {
          console.log("No choices in response");
        }
        
        // 从响应中提取图像 URL
        let generatedImageUrl = '';
        let isGenerationFailed = false;
        
        if (response.choices && response.choices.length > 0) {
          const result = response.choices[0].message.content;
          console.log('处理图像 URL 提取，原始结果:', result);
          
          // 尝试匹配图像 URL
          // 1. 先尝试匹配 Markdown 格式的图像链接
          let imgUrlMatch = result.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/i);
          
          // 2. 如果没有找到，尝试匹配下载链接
          if (!imgUrlMatch) {
            imgUrlMatch = result.match(/\[\u4e0b\u8f7d[^\]]*\]\((https?:\/\/[^\s)]+)\)/i);
          }
          
          // 3. 如果还是没有找到，尝试匹配 OpenAI 特有的 oaiusercontent 链接
          if (!imgUrlMatch) {
            imgUrlMatch = result.match(/(https?:\/\/oaiusercontent[^\s"'<>]+)/i);
          }
          
          console.log('图像 URL 匹配结果:', imgUrlMatch);
          
          // 从匹配结果中提取 URL
          if (imgUrlMatch && imgUrlMatch[1]) {
            // 如果有捕获组，使用第一个捕获组
            generatedImageUrl = imgUrlMatch[1];
          } else if (imgUrlMatch && imgUrlMatch[0] && imgUrlMatch[0].startsWith('http')) {
            // 如果没有捕获组，但整个匹配是 URL
            generatedImageUrl = imgUrlMatch[0];
          }
          
          console.log('提取的图像 URL:', generatedImageUrl);
        }
        
        // 如果没有找到图像 URL，使用原始图像作为占位，并标记生成失败
        if (!generatedImageUrl) {
          console.log('未找到图像 URL，使用原始图像作为占位');
          generatedImageUrl = originalImagePath;
          isGenerationFailed = true; // 标记为生成失败
        } else if (useOSS && generatedImageUrl && generatedImageUrl.startsWith('http')) {
          // 检查URL是否是直接可用的图片格式
          const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
          const isDirectImageUrl = imageExtensions.some(ext => 
            generatedImageUrl.toLowerCase().endsWith(ext) || generatedImageUrl.toLowerCase().includes(`${ext}?`)
          );
          
          if (!isDirectImageUrl) {
            // 如果不是直接的图片URL，需要下载图片内容并上传到OSS
            try {
              console.log('将生成的图像从URL下载并上传到OSS:', generatedImageUrl);
              // 使用fetch直接下载图片内容
              const response = await fetch(generatedImageUrl, {
                timeout: 30000,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
              });
              
              if (!response.ok) {
                throw new Error(`下载图片失败，HTTP状态: ${response.status}`);
              }
              
              // 获取图片二进制数据
              const imageBuffer = Buffer.from(await response.arrayBuffer());
              
              // 生成文件名和OSS路径
              const ossPath = `kdy-generated/${Date.now()}_openai_image.jpg`;
              
              // 上传图片二进制内容到OSS
              const result = await ossClient.put(ossPath, imageBuffer);
              
              // 生成可访问的URL
              const url = process.env.OSS_BUCKET_URL 
                ? `${process.env.OSS_BUCKET_URL}/${ossPath}`
                : result.url;
                
              generatedImageUrl = url;
              console.log('图像已下载并上传到OSS:', generatedImageUrl);
            } catch (ossError) {
              console.error('下载并上传生成图像到OSS失败，使用原始URL:', ossError);
              // 出错时保留原URL
            }
          } else {
            console.log('URL是直接的图片格式，不需要下载:', generatedImageUrl);
          }
        }
        
        // 保存生成历史记录
        const generatedImageData = {
          user: req.user._id,
          generatedImage: generatedImageUrl,
          prompt: prompt,
          model: selectedModel,
          creditsUsed: isGenerationFailed ? 1 : creditsToUse, // 如果生成失败，只扣1积分
          mode: mode,
          status: isGenerationFailed ? 'failed' : 'success', // 添加状态
          errorMessage: isGenerationFailed ? '未能生成有效图像' : null // 添加错误消息
        };
        
        // 只有图生图模式才添加原始图像
        if (mode === 'image-to-image' && originalImagePath) {
          generatedImageData.originalImage = originalImagePath;
        }
        
        const generatedImage = new GeneratedImage(generatedImageData);
        
        // 保存到数据库
        await generatedImage.save().catch(err => {
          console.error('保存历史记录失败:', err);
        });
        
        // 扣除用户积分 - 根据生成结果调整积分消耗
        const actualCreditsToUse = isGenerationFailed ? 1 : creditsToUse; // 如果生成失败，只扣1积分
        
        const newCreditBalance = await useCredits(
          req.user._id, 
          actualCreditsToUse,  // 使用调整后的积分数量
          isGenerationFailed ? `生成图像失败 (${selectedModel})` : `生成图像 (${selectedModel})`, 
          generatedImage._id  // 使用已保存的生成图像记录ID，而不是未定义的imageHistory
        );
        
        // 发送响应回客户端
        res.json({ 
          success: true, 
          result: response.choices[0].message.content,
          originalImage: originalImagePath,
          generationFailed: isGenerationFailed, // 添加生成失败标记
          credits: {
            used: actualCreditsToUse, // 返回实际扣除的积分
            remaining: newCreditBalance
          },
          updatedCredits: newCreditBalance, // 添加更新后的积分，方便前端直接使用
          historyId: generatedImage._id,  // 使用正确的ID
          model: selectedModel  // 返回使用的模型名称
        });
      }
    } catch (apiError) {
      console.error('OpenAI API Error:');
      console.error('Error name:', apiError.name);
      console.error('Error message:', apiError.message);
      console.error('Error stack:', apiError.stack);
      
      if (apiError.response) {
        console.error('API Response status:', apiError.response.status);
        console.error('API Response data:', JSON.stringify(apiError.response.data, null, 2));
      }
      
      let errorMessage = 'OpenAI API Error';
      let statusCode = 500;
      
      // 分析错误类型并提供更有用的错误信息
      if (apiError.message.includes('Connection error')) {
        errorMessage = '无法连接到 OpenAI API。请检查您的网络连接和 API 配置。';
        console.error('请检查您的代理设置或防火墙配置，确保可以访问 api.openai.com');
      } else if (apiError.message.includes('timeout')) {
        errorMessage = '请求超时。OpenAI API 响应时间过长。';
      } else if (apiError.message.includes('401')) {
        errorMessage = 'API 密钥无效。请检查您的 OpenAI API 密钥。';
        statusCode = 401;
      } else if (apiError.message.includes('429')) {
        errorMessage = '请求频率超限。请稍后再试。';
        statusCode = 429;
      } else if (apiError.message.includes('Premature close')) {
        errorMessage = '连接过早关闭。这可能是由于网络问题或代理设置导致的。';
        console.error('请检查您的网络连接和代理设置');
      }
      
      // 使用统一的错误处理函数
      await handleError(apiError, statusCode, errorMessage);
    }
    
  } catch (error) {
    await handleError(error, 500, 'Error processing image');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  
  // 检查OSS配置并打印状态
  console.log('----------------------------------------');
  console.log('系统配置状态:');
  console.log(`- OSS存储: ${useOSS ? '已启用' : '未启用，使用本地存储'}`);
  if (useOSS) {
    console.log(`- OSS区域: ${process.env.OSS_REGION}`);
    console.log(`- OSS存储桶: ${process.env.OSS_BUCKET}`);
    console.log(`- OSS访问URL: ${process.env.OSS_BUCKET_URL}`);
    console.log(`- OSS上传文件夹: kdy-uploads/`);
    console.log(`- OSS生成图片文件夹: kdy-generated/`);
  } else {
    console.log('- 如需启用OSS存储，请在.env文件中配置OSS相关参数');
  }
  console.log(`- 本地上传目录: ${path.join(__dirname, 'uploads')}`);
  console.log('----------------------------------------');
});

// 全局未捕获异常处理
process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的拒绝:', reason);
});
