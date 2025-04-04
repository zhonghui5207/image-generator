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
import smsRoutes from './routes/smsRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';

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
app.use('/api/sms', smsRoutes);
app.use('/api/payment', paymentRoutes);

// Helper function to convert image to base64
function image2Base64(imagePath) {
  const image = fs.readFileSync(imagePath);
  return image.toString('base64');
}

// API endpoint for image generation
app.post('/api/generate-image', authenticate, checkCredits, upload.single('image'), async (req, res) => {
  try {
    // 获取生成模式
    const mode = req.body.mode || 'image-to-image';
    
    // 检查图生图模式是否需要图片
    if (mode === 'image-to-image' && !req.file) {
      return res.status(400).json({ error: '图生图模式需要上传图片' });
    }

    const prompt = req.body.prompt || 'Transform this image into a creative style';
    let imagePath = null;
    let imageType = null;
    let originalImagePath = null;
    
    // 只有图生图模式才处理图片
    if (mode === 'image-to-image' && req.file) {
      imagePath = req.file.path;
      imageType = path.extname(req.file.originalname).substring(1);
      // 将原始图像保存到公共目录
      originalImagePath = `/uploads/${path.basename(imagePath)}`;
    }
    
    // 获取所选模型，如果没有指定则使用环境变量中的默认值
    const selectedModel = req.body.model || process.env.OPENAI_MODEL;
    console.log("Selected model:", selectedModel);
    
    // 确定消耗的积分数量
    let creditsToUse;
    
    // 根据不同模型设置积分消耗
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
      
      // 使用 OpenAI 的 chat completions API
      console.log("Sending request to OpenAI API...");
      // 检查是否请求流式响应
      const useStream = req.query.stream === 'true';
      
      if (useStream) {
        // 流式响应处理
        console.log("Using streaming response");
        
        // 设置响应头信息以支持流式传输
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        // 准备消息内容
        let messages = [];
        
        if (mode === 'image-to-image') {
          // 图生图模式：包含图片和提示词
          const imageBase64 = image2Base64(imagePath);
          console.log("Image converted to base64, length:", imageBase64.length);
          
          messages = [{
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
        
        // 创建流式请求
        const stream = await openai.chat.completions.create({
          model: selectedModel,
          messages: messages,
          stream: true,
          timeout: 300000  // 增加到 5 分钟超时
        });
        
        console.log("流式连接已建立，开始发送数据...");
        
        // 发送初始信息
        const initialData = {
          type: 'info',
          content: {}
        };
        
        // 只有图生图模式才发送原始图像路径
        if (mode === 'image-to-image' && originalImagePath) {
          initialData.content.originalImage = originalImagePath;
        }
        
        res.write(`data: ${JSON.stringify(initialData)}\n\n`);
        
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
          generatedImageUrl = originalImagePath;
          isGenerationFailed = true; // 标记为生成失败
        }
        
        // 扣除用户积分 - 根据生成结果调整积分消耗
        const actualCreditsToUse = isGenerationFailed ? 1 : creditsToUse; // 如果生成失败，只扣1积分
        
        const newCreditBalance = await useCredits(
          req.user._id, 
          actualCreditsToUse,  // 使用调整后的积分数量
          isGenerationFailed ? `生成图像失败 (${selectedModel})` : `生成图像 (${selectedModel})`, 
          imageHistory._id
        );
        
        // 保存生成历史记录
        const generatedImageData = {
          user: req.user._id, // 修正：使用user字段而不是userId，与模型定义一致,
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
            historyId: generatedImage._id
          }
        })}\n\n`);
        
        // 结束流式响应
        res.end();
        return;
      } else {
        // 非流式响应处理（原有方式）
        let messages = [];
        
        if (mode === 'image-to-image') {
          // 图生图模式：包含图片和提示词
          const imageBase64 = image2Base64(imagePath);
          
          messages = [{
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
        }
        
        // 保存生成历史记录
        const generatedImageData = {
          user: req.user._id, // 修正：使用user字段而不是userId，与模型定义一致,
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
          imageHistory._id
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
          historyId: imageHistory._id,
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
      
      try {
        // API错误时，也保存一条失败的生成记录
        if (!res.headersSent) {
          // 生成失败时只扣除1积分
          const failureCreditsToUse = 1;
          
          // 保存失败的生成历史记录
          const failedImageData = {
            user: req.user._id,
            generatedImage: originalImagePath || '', // 使用原始图像或空字符串
            prompt: prompt,
            model: selectedModel,
            creditsUsed: failureCreditsToUse,
            mode: mode,
            status: 'failed',
            errorMessage: errorMessage
          };
          
          // 如果是图生图模式且有原始图像，添加原始图像
          if (mode === 'image-to-image' && originalImagePath) {
            failedImageData.originalImage = originalImagePath;
          }
          
          // 保存失败记录
          const failedImage = new GeneratedImage(failedImageData);
          await failedImage.save().catch(err => {
            console.error('保存失败历史记录错误:', err);
          });
          
          // 扣除1积分
          const newCreditBalance = await useCredits(
            req.user._id,
            failureCreditsToUse,
            `生成图像失败 (${selectedModel}) - ${errorMessage}`,
            failedImage._id
          ).catch(err => {
            console.error('扣除积分错误:', err);
            return req.user.credits - failureCreditsToUse; // 如果扣积分失败，估算新余额
          });
          
          res.status(statusCode).json({ 
            error: errorMessage,
            details: apiError.message,
            apiResponse: apiError.response?.data || null,
            generationFailed: true,
            credits: {
              used: failureCreditsToUse,
              remaining: newCreditBalance
            }
          });
        }
      } catch (creditError) {
        console.error('处理API错误时积分处理失败:', creditError);
        
        // 只在尚未发送响应时发送错误响应
        if (!res.headersSent) {
          res.status(statusCode).json({ 
            error: errorMessage, 
            details: apiError.message,
            apiResponse: apiError.response?.data || null,
            generationFailed: true
          });
        }
      }
    }
    
  } catch (error) {
    console.error('Error processing image:', error);
    // 只在尚未发送响应时发送错误响应
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error processing image', details: error.message });
    }
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
