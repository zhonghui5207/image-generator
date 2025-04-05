import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// MongoDB连接URI，从环境变量获取或使用默认值
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/imagegenerator';

// 连接到MongoDB
async function connectToDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    
    console.log('MongoDB数据库连接成功:', MONGODB_URI);
    
    // 监听断开连接事件
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB连接已断开');
    });
    
    // 监听错误事件
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB连接错误:', err);
    });
    
    // 捕获进程终止信号，关闭数据库连接
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('已关闭MongoDB连接');
      process.exit(0);
    });
    
  } catch (err) {
    console.error('MongoDB数据库连接失败:', err.message);
    // 不要立即退出进程，让应用尝试继续运行
    console.error('请确保MongoDB服务已启动并且可访问');
  }
}

// 调用连接函数
connectToDatabase();

export default mongoose;
