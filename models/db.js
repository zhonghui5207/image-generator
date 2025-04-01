import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { MongoMemoryServer } from 'mongodb-memory-server';

dotenv.config();

// 创建内存中的 MongoDB 实例
let mongoServer;

// 初始化并连接到内存数据库
async function initializeMongoServer() {
  try {
    // 创建内存中的 MongoDB 实例
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    console.log('使用内存数据库连接:', mongoUri);
    
    // 连接到内存数据库
    await mongoose.connect(mongoUri);
    
    console.log('MongoDB内存数据库连接成功');
    
    // 在应用程序关闭时关闭数据库连接
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB连接已断开');
    });
    
    // 捕获进程终止信号，关闭数据库连接
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      if (mongoServer) {
        await mongoServer.stop();
      }
      console.log('已关闭MongoDB连接和内存服务器');
      process.exit(0);
    });
    
  } catch (err) {
    console.error('MongoDB内存数据库初始化失败:', err.message);
    process.exit(1);
  }
}

// 调用初始化函数
initializeMongoServer();

export default mongoose;
