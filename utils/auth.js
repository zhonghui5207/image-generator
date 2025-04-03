import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_this_in_production';

// 确保 JWT_SECRET 已设置
console.log('JWT_SECRET 是否已设置:', !!JWT_SECRET);
if (!JWT_SECRET) {
  console.error('警告: JWT_SECRET 未设置，使用默认值。在生产环境中这是不安全的。');
}

// 生成JWT令牌
export const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: '30d' // 令牌30天有效
  });
};

// 验证JWT令牌中间件
export const authenticate = async (req, res, next) => {
  try {
    console.log('认证中间件已调用，路径:', req.path);
    
    // 从cookie或请求头中获取令牌
    const token = req.cookies.token || 
                 (req.headers.authorization && req.headers.authorization.startsWith('Bearer') 
                  ? req.headers.authorization.split(' ')[1] : null);
    
    console.log('令牌是否存在:', !!token);
    console.log('Cookie内容:', req.cookies);
    console.log('Authorization头:', req.headers.authorization);
    
    if (!token) {
      console.log('未找到令牌，返回未授权错误');
      return res.status(401).json({ success: false, message: '未授权，请登录' });
    }
    
    // 验证令牌
    console.log('开始验证令牌...');
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('令牌验证成功，用户ID:', decoded.id);
    
    // 查找用户
    console.log('开始查找用户...');
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      console.log('用户不存在:', decoded.id);
      return res.status(401).json({ success: false, message: '用户不存在' });
    }
    
    console.log('认证成功，用户:', user.username);
    
    // 将用户信息添加到请求对象
    req.user = user;
    next();
  } catch (error) {
    console.error('认证错误:', error);
    return res.status(401).json({ success: false, message: '令牌无效或已过期' });
  }
};

// 检查积分中间件
export const checkCredits = async (req, res, next) => {
  try {
    const { user } = req;
    
    // 获取所选模型，默认使用环境变量中的模型
    const selectedModel = req.body.model || process.env.OPENAI_MODEL;
    
    // 确定所需积分数量
    let requiredCredits = 1; // 默认消耗1积分
    if (selectedModel === 'gpt-4o-image-vip') {
      requiredCredits = 2; // VIP模型消耗2积分
    }
    
    // 检查用户积分是否足够
    if (user.credits < requiredCredits) {
      // 如果是流式请求，使用流式响应格式返回错误
      if (req.headers.accept && req.headers.accept.includes('text/event-stream')) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        // 发送错误信息作为流式事件
        res.write(`data: ${JSON.stringify({
          type: 'error',
          content: {
            message: '积分不足，请充值',
            creditsNeeded: requiredCredits - user.credits,
            requiredCredits: requiredCredits,
            currentCredits: user.credits
          }
        })}\n\n`);
        
        // 结束响应
        res.end();
        return;
      } else {
        // 普通请求返回JSON错误
        return res.status(402).json({ 
          success: false, 
          message: '积分不足，请充值',
          creditsNeeded: requiredCredits - user.credits,
          requiredCredits: requiredCredits,
          currentCredits: user.credits
        });
      }
    }
    
    // 积分充足，继续处理请求
    next();
  } catch (error) {
    console.error('检查积分错误:', error);
    return res.status(500).json({ success: false, message: '服务器错误' });
  }
};

// 管理员权限检查中间件
export const isAdmin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(403).json({ success: false, message: '需要管理员权限' });
  }
};
