import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// MongoDB连接URI，从环境变量获取或使用默认值
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/imagegenerator';

// 连接选项
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,               // 连接池大小
  socketTimeoutMS: 45000,        // 套接字超时时间
  serverSelectionTimeoutMS: 5000,// 服务器选择超时
  heartbeatFrequencyMS: 10000,   // 心跳频率
  keepAlive: true,               // 保持连接活跃
  keepAliveInitialDelay: 300000, // 保持连接初始延迟
  autoIndex: true,               // 自动创建索引
  serverApi: {
    version: '1',                // 使用最新的服务器API版本
    strict: true,
    deprecationErrors: true,
  }
};

// 连接状态标志
let isConnecting = false;

// 连接到MongoDB
async function connectToDatabase() {
  // 防止多次连接尝试
  if (isConnecting) return;
  
  isConnecting = true;
  
  try {
    await mongoose.connect(MONGODB_URI, mongooseOptions);
    console.log('MongoDB数据库连接成功:', MONGODB_URI);
    isConnecting = false;
    
    // 监听断开连接事件
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB连接已断开');
      // 不要在这里立即重连，可能会导致连接风暴
      // 而是在一段时间后尝试重连
      setTimeout(() => {
        if (!isConnecting && mongoose.connection.readyState !== 1) {
          console.log('尝试重新连接MongoDB...');
          connectToDatabase();
        }
      }, 5000); // 5秒后尝试重连
    });
    
    // 监听错误事件
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB连接错误:', err);
      // 错误发生后不要立即重连，等待一段时间
    });
    
    // 监听连接成功事件
    mongoose.connection.on('connected', () => {
      console.log('MongoDB连接已建立');
    });
    
    // 捕获进程终止信号，关闭数据库连接
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        console.log('已关闭MongoDB连接');
        process.exit(0);
      } catch (err) {
        console.error('关闭MongoDB连接时出错:', err);
        process.exit(1);
      }
    });
    
  } catch (err) {
    console.error('MongoDB数据库连接失败:', err.message);
    console.error('请确保MongoDB服务已启动并且可访问');
    isConnecting = false;
    
    // 连接失败后延迟重试
    setTimeout(() => {
      console.log('尝试重新连接MongoDB...');
      connectToDatabase();
    }, 10000); // 10秒后重试
  }
}

// 调用连接函数
connectToDatabase();

export default mongoose;
