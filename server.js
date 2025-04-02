import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import https from 'https';
import cookieParser from 'cookie-parser';
import mongoose from './models/db.js';

// 导入路由
import authRoutes from './routes/authRoutes.js';
import creditRoutes from './routes/creditRoutes.js';
import imageHistoryRoutes from './routes/imageHistoryRoutes.js';

// 导入中间件和工具
import { authenticate, checkCredits } from './utils/auth.js';
import { useCredits } from './routes/creditRoutes.js';
import GeneratedImage from './models/GeneratedImage.js';

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

const upload = multer({ 
  storage: storage,
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

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json());

// 注册API路由
app.use('/api/auth', authRoutes);
app.use('/api/credits', creditRoutes);
app.use('/api/history', imageHistoryRoutes);

// Helper function to convert image to base64
function image2Base64(imagePath) {
  const image = fs.readFileSync(imagePath);
  return image.toString('base64');
}

// API endpoint for image generation
app.post('/api/generate-image', authenticate, checkCredits, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const prompt = req.body.prompt || 'Transform this image into a creative style';
    const imagePath = req.file.path;
    const imageType = path.extname(req.file.originalname).substring(1);
    
    // 获取所选模型，如果没有指定则使用环境变量中的默认值
    const selectedModel = req.body.model || process.env.OPENAI_MODEL;
    console.log("Selected model:", selectedModel);
    
    // 确定消耗的积分数量
    let creditsToUse = 1; // 默认消耗1积分
    if (selectedModel === 'gpt-4o-image-vip') {
      creditsToUse = 2; // VIP模型消耗2积分
    }
    
    // 检查用户积分是否足够
    if (req.user.credits < creditsToUse) {
      return res.status(402).json({ 
        success: false, 
        message: '积分不足，请充值',
        creditsNeeded: creditsToUse - req.user.credits
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
      
      // 准备图像数据
      const imageBase64 = image2Base64(imagePath);
      console.log("Image converted to base64, length:", imageBase64.length);
      
      // 不再使用单独的连接测试，因为它可能导致额外的错误
      
      // 将原始图像保存到公共目录
      const originalImagePath = `/uploads/${path.basename(imagePath)}`;
      
      // 使用 OpenAI 的 chat completions API
      console.log("Sending request to OpenAI API...");
      const response = await openai.chat.completions.create({
        model: selectedModel,
        messages: [{
          role: 'user', 
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/${imageType};base64,${imageBase64}`
              }
            },
            {
              type: "text",
              text: prompt
            },
          ]
        }],
        timeout: 300000  // 增加到 5 分钟超时
      });

        console.log("Chat API response received");
        console.log("Response structure:", JSON.stringify(Object.keys(response)));
        if (response.choices && response.choices.length > 0) {
          console.log("First choice:", JSON.stringify(response.choices[0]));
        } else {
          console.log("No choices in response");
        }
        
      console.log("Response received from OpenAI API");
      console.log("Response structure:", JSON.stringify(Object.keys(response)));
      if (response.choices && response.choices.length > 0) {
        console.log("First choice:", JSON.stringify(response.choices[0]));
      } else {
        console.log("No choices in response");
      }

      // 从响应中提取图像 URL
      let generatedImageUrl = '';
      
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
      
      // 如果没有找到图像 URL，使用原始图像作为占位
      if (!generatedImageUrl) {
        console.log('未找到图像 URL，使用原始图像作为占位');
        generatedImageUrl = originalImagePath;
      }
      
      // 创建历史记录
      const imageHistory = await GeneratedImage.create({
        user: req.user._id,
        originalImage: originalImagePath,
        generatedImage: generatedImageUrl,
        prompt: prompt,
        creditsUsed: creditsToUse  // 使用实际消耗的积分数量
      });
      
      // 扣除用户积分
      const newCreditBalance = await useCredits(
        req.user._id, 
        creditsToUse,  // 使用实际消耗的积分数量
        `生成图像 (${selectedModel})`, 
        imageHistory._id
      );
      
      // 发送响应回客户端
      res.json({ 
        success: true, 
        result: response.choices[0].message.content,
        originalImage: originalImagePath,
        credits: {
          used: creditsToUse,
          remaining: newCreditBalance
        },
        updatedCredits: newCreditBalance, // 添加更新后的积分，方便前端直接使用
        historyId: imageHistory._id,
        model: selectedModel  // 返回使用的模型名称
      });
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
      }
      
      res.status(statusCode).json({ 
        error: errorMessage, 
        details: apiError.message,
        apiResponse: apiError.response?.data || null
      });
    }
    
  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).json({ error: 'Error processing image', details: error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
