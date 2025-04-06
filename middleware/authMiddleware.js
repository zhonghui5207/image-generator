import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// 从环境变量获取JWT密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 认证中间件 - 验证用户是否已登录
export const authenticate = async (req, res, next) => {
  try {
    // 从请求头获取token
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // 如果没有token，尝试从cookie中获取
      const token = req.cookies && req.cookies.token;
      
      if (!token) {
        return res.status(401).json({ success: false, message: '未授权，请先登录' });
      }
      
      // 验证token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // 查找用户
      const user = await User.findById(decoded.userId);
      
      if (!user) {
        return res.status(401).json({ success: false, message: '用户不存在' });
      }
      
      // 将用户信息添加到请求对象
      req.user = user;
      
      // 继续下一步
      next();
    } else {
      // 从Bearer token提取token
      const token = authHeader.split(' ')[1];
      
      // 验证token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // 查找用户
      const user = await User.findById(decoded.userId);
      
      if (!user) {
        return res.status(401).json({ success: false, message: '用户不存在' });
      }
      
      // 将用户信息添加到请求对象
      req.user = user;
      
      // 继续下一步
      next();
    }
  } catch (error) {
    console.error('认证错误:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: '无效的token' });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'token已过期，请重新登录' });
    }
    
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}; 