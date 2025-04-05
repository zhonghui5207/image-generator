import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// 验证用户是否已登录
const authenticate = async (req, res, next) => {
  try {
    // 获取 token
    const token = req.cookies.token || req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      // 检查是否是AJAX请求或API请求
      const isApiRequest = req.xhr || req.path.startsWith('/api/') || 
                          req.headers.accept === 'application/json';
      
      if (isApiRequest) {
        // 如果是API请求，返回JSON格式的401错误
        return res.status(401).json({ 
          success: false, 
          message: '需要登录后才能访问此功能',
          redirectTo: '/login.html'
        });
      } else {
        // 如果是普通页面请求，重定向到登录页
        return res.redirect('/login.html');
      }
    }
    
    // 验证 token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 根据 token 中的用户 ID 查找用户
    const user = await User.findById(decoded.id);
    
    if (!user) {
      // 检查是否是AJAX请求或API请求
      const isApiRequest = req.xhr || req.path.startsWith('/api/') || 
                          req.headers.accept === 'application/json';
      
      if (isApiRequest) {
        return res.status(401).json({ 
          success: false, 
          message: '用户不存在或已被删除',
          redirectTo: '/login.html'
        });
      } else {
        return res.redirect('/login.html');
      }
    }
    
    // 将用户信息添加到请求对象
    req.user = user;
    next();
  } catch (error) {
    console.error('认证错误:', error);
    
    // 检查是否是AJAX请求或API请求
    const isApiRequest = req.xhr || req.path.startsWith('/api/') || 
                          req.headers.accept === 'application/json';
    
    if (isApiRequest) {
      return res.status(401).json({ 
        success: false, 
        message: '认证失败: ' + (error.message || '未知错误'),
        redirectTo: '/login.html'
      });
    } else {
      return res.redirect('/login.html');
    }
  }
};

export default authenticate; 