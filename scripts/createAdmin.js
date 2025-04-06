import mongoose from 'mongoose';
import User from '../models/User.js';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 连接数据库
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/image-generator')
  .then(() => console.log('MongoDB连接成功'))
  .catch(err => {
    console.error('MongoDB连接失败', err);
    process.exit(1);
  });

// 创建管理员账户
async function createAdmin() {
  try {
    // 检查管理员是否已存在
    const existingAdmin = await User.findOne({ username: 'kdyai' });
    
    if (existingAdmin) {
      console.log('管理员账户已存在，正在更新...');
      existingAdmin.password = 'kdyai';
      existingAdmin.isAdmin = true;
      await existingAdmin.save();
      console.log('管理员账户已更新!');
    } else {
      // 创建新管理员
      const admin = new User({
        username: 'kdyai',
        email: 'admin@kdyai.com',
        password: 'kdyai',
        isAdmin: true,
        credits: 9999,
        phoneVerified: true
      });
      
      await admin.save();
      console.log('管理员账户创建成功!');
    }
    
    // 显示所有管理员用户
    const admins = await User.find({ isAdmin: true }).select('-password');
    console.log('系统管理员列表:', admins);
    
    // 断开数据库连接
    mongoose.disconnect();
  } catch (error) {
    console.error('创建管理员账户失败:', error);
    mongoose.disconnect();
    process.exit(1);
  }
}

// 执行创建管理员账户
createAdmin(); 