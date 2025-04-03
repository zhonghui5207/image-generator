const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件配置
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 静态文件服务 - 指向项目根目录下的public文件夹
app.use(express.static(path.join(__dirname, '../public')));

// 示例API路由
app.get('/api/admin/users', (req, res) => {
  res.json({
    success: true,
    total: 3,
    users: [
      { _id: '001', username: 'user1', email: 'user1@example.com', phone: '13800138001', credits: 100, status: 'active', createdAt: new Date() },
      { _id: '002', username: 'user2', email: 'user2@example.com', phone: '13800138002', credits: 50, status: 'active', createdAt: new Date() },
      { _id: '003', username: 'user3', email: 'user3@example.com', phone: '13800138003', credits: 0, status: 'inactive', createdAt: new Date() }
    ]
  });
});

app.get('/api/admin/orders/stats', (req, res) => {
  res.json({
    success: true,
    stats: {
      todayCount: 5,
      todayRevenue: 580,
      monthCount: 78,
      monthRevenue: 9860
    }
  });
});

app.get('/api/admin/orders', (req, res) => {
  res.json({
    success: true,
    total: 3,
    orders: [
      { _id: '001', orderNumber: 'ORD20230101001', username: 'user1', productName: '积分充值套餐A', amount: 100, credits: 110, paymentMethod: 'wechat', status: 'paid', createdAt: new Date() },
      { _id: '002', orderNumber: 'ORD20230101002', username: 'user2', productName: '积分充值套餐B', amount: 200, credits: 230, paymentMethod: 'alipay', status: 'pending', createdAt: new Date() },
      { _id: '003', orderNumber: 'ORD20230101003', username: 'user3', productName: '积分充值套餐C', amount: 500, credits: 600, paymentMethod: 'manual', status: 'completed', createdAt: new Date() }
    ]
  });
});

app.get('/api/admin/credits/stats', (req, res) => {
  res.json({
    success: true,
    stats: {
      totalIssued: 5000,
      totalConsumed: 3200,
      systemBalance: 1800,
      monthlyTransactions: 125
    }
  });
});

app.get('/api/admin/credits/transactions', (req, res) => {
  res.json({
    success: true,
    total: 3,
    transactions: [
      { _id: '001', username: 'user1', type: 'purchase', amount: 100, balance: 100, orderNumber: 'ORD20230101001', note: '购买积分套餐A', createdAt: new Date() },
      { _id: '002', username: 'user2', type: 'consume', amount: -10, balance: 90, note: '生成图片消费', createdAt: new Date() },
      { _id: '003', username: 'admin', type: 'admin', amount: 50, balance: 140, note: '管理员调整', createdAt: new Date() }
    ]
  });
});

app.get('/api/admin/images/stats', (req, res) => {
  res.json({
    success: true,
    stats: {
      totalCount: 1250,
      todayCount: 78,
      monthCount: 560,
      popularStyle: '油画风格',
      users: [
        { id: '001', username: 'user1' },
        { id: '002', username: 'user2' },
        { id: '003', username: 'user3' }
      ],
      styles: ['油画风格', '水彩风格', '素描风格', '卡通风格', '像素风格']
    }
  });
});

app.get('/api/admin/images', (req, res) => {
  res.json({
    success: true,
    total: 3,
    images: [
      { _id: '001', url: 'https://via.placeholder.com/300/FF5733/FFFFFF?text=Image1', username: 'user1', prompt: '山水画，湖泊，日出', style: '油画风格', width: 512, height: 512, createdAt: new Date() },
      { _id: '002', url: 'https://via.placeholder.com/300/33FF57/FFFFFF?text=Image2', username: 'user2', prompt: '森林，小路，阳光', style: '水彩风格', width: 512, height: 512, createdAt: new Date() },
      { _id: '003', url: 'https://via.placeholder.com/300/3357FF/FFFFFF?text=Image3', username: 'user3', prompt: '城市，摩天大楼，夜景', style: '素描风格', width: 512, height: 512, createdAt: new Date() }
    ]
  });
});

// 登录认证接口
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  
  // 简单验证 - 实际应用需要更复杂的认证方式
  if (username === 'admin' && password === 'admin123') {
    res.json({
      success: true,
      token: 'mock-jwt-token-for-admin',
      user: {
        id: 'admin001',
        username: 'admin',
        role: 'admin'
      }
    });
  } else {
    res.status(401).json({
      success: false,
      message: '用户名或密码错误'
    });
  }
});

// 通用路由响应所有未匹配的GET请求，发送index.html
app.get('*', (req, res) => {
  // 检查URL是否指向admin下的HTML文件
  if (req.url.startsWith('/admin/') && req.url.endsWith('.html')) {
    const filePath = path.join(__dirname, '../public', req.url);
    
    // 检查文件是否存在
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
  }
  
  // 对于其他请求，发送管理后台首页
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Admin panel available at http://localhost:${PORT}/admin/login.html`);
}); 