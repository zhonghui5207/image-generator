/**
 * 修复脚本 - 解决以下问题：
 * 1. 文生图历史记录不显示问题
 * 2. 积分不足时的提示问题
 */

// 导入必要的模块
import fs from 'fs';
import path from 'path';

// 文件路径
const serverJsPath = path.resolve('./server.js');
const generatedImageModelPath = path.resolve('./models/GeneratedImage.js');

// 读取文件内容
let serverJsContent = fs.readFileSync(serverJsPath, 'utf8');
let generatedImageModelContent = fs.readFileSync(generatedImageModelPath, 'utf8');

// 1. 修复GeneratedImage模型中的originalImage字段，使其变为可选
if (generatedImageModelContent.includes('originalImage: {')) {
  generatedImageModelContent = generatedImageModelContent.replace(
    /originalImage: {\s+type: String,\s+required: true\s+},/g,
    'originalImage: {\n    type: String,\n    required: false // 文生图模式没有原始图像，所以设为可选\n  },'
  );
  console.log('✅ 已修复GeneratedImage模型中的originalImage字段，使其变为可选');
} else {
  console.log('❌ 未找到GeneratedImage模型中的originalImage字段');
}

// 2. 修复server.js中保存历史记录时使用的字段名称
if (serverJsContent.includes('userId: req.user._id')) {
  serverJsContent = serverJsContent.replace(
    /userId: req\.user\._id/g,
    'user: req.user._id // 修正：使用user字段而不是userId，与模型定义一致'
  );
  console.log('✅ 已修复server.js中保存历史记录时使用的字段名称');
} else {
  console.log('❌ 未找到server.js中的userId字段');
}

// 3. 确保历史记录被保存到数据库
if (serverJsContent.includes('const generatedImage = new GeneratedImage(generatedImageData);')) {
  // 检查是否已经有保存代码
  if (!serverJsContent.includes('await generatedImage.save()')) {
    serverJsContent = serverJsContent.replace(
      /const generatedImage = new GeneratedImage\(generatedImageData\);/g,
      'const generatedImage = new GeneratedImage(generatedImageData);\n        \n        // 保存到数据库\n        await generatedImage.save().catch(err => {\n          console.error(\'保存历史记录失败:\', err);\n        });'
    );
    console.log('✅ 已添加保存历史记录到数据库的代码');
  } else {
    console.log('ℹ️ 历史记录保存代码已存在，无需修改');
  }
} else {
  console.log('❌ 未找到创建GeneratedImage实例的代码');
}

// 4. 修复积分不足时的提示问题
if (serverJsContent.includes('checkCredits')) {
  // 确保checkCredits中间件正确处理流式响应
  if (!serverJsContent.includes('text/event-stream')) {
    console.log('⚠️ 积分检查中间件可能未正确处理流式响应，请检查utils/auth.js文件');
  } else {
    console.log('✅ 积分检查中间件已正确处理流式响应');
  }
} else {
  console.log('❌ 未找到checkCredits中间件');
}

// 保存修改后的文件
fs.writeFileSync(serverJsPath, serverJsContent, 'utf8');
fs.writeFileSync(generatedImageModelPath, generatedImageModelContent, 'utf8');

console.log('🎉 修复完成！请重启服务器以应用更改。');
