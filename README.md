# 柯达鸭 AI 图像生成器

这是一个使用 OpenAI API 生成图像的应用程序。

## 功能

- 使用简洁友好的界面生成图像
- 支持文生图和图生图两种模式
- 用户注册登录系统
- 积分系统，控制API使用量
- 支持历史记录保存和浏览
- 使用 OpenAI GPT-4o 进行图像生成
- 支持管理后台
- 支持移动端响应式界面

## 安装步骤

1. 克隆仓库：

```bash
git clone [仓库地址]
cd image-generoter
```

2. 安装依赖：

```bash
npm install
```

3. 配置环境变量：

在项目根目录创建 `.env` 文件，添加以下内容：

```
OPENAI_API_KEY=你的OpenAI_API密钥
OPENAI_BASE_URL=https://api.tu-zi.com/v1  # 可使用代理服务
OPENAI_MODEL=gpt-4o-image-vip
PORT=3000
```

4. 启动应用：

```bash
npm start
```

应用将在 http://localhost:3000 运行。

## 使用方法

1. 打开应用后，点击上传区域或拖放图片到指定区域
2. 在提示词文本框中输入描述，或选择预设风格
3. 点击"生成图像"按钮
4. 等待生成完成后查看结果
5. 点击"新的生成"按钮开始新的图像生成

## 技术栈

- 前端：HTML, CSS, JavaScript
- 后端：Node.js, Express
- 文件处理：Multer
- API：OpenAI GPT-4o

## 注意事项

- 需要有效的 OpenAI API 密钥
- 图片上传大小限制为 10MB
- 支持的图片格式：JPG, PNG, GIF, WebP
- 生成过程可能需要一些时间，请耐心等待
- 下载的图像将自动转换为 JPEG 格式

## 部署指南

### Vercel 部署

1. Fork 此仓库
2. 在 Vercel 中导入项目
3. 设置环境变量
4. 部署应用

### 宝塔面板部署

1. 在宝塔面板中安装 Node.js 环境
2. 上传项目文件到服务器
3. 安装依赖：`npm install`
4. 使用 PM2 启动应用：`pm2 start server.js --name image-generator`
5. 配置 Nginx 反向代理

## 未来计划

- 用户账户系统
- 积分消费模式
- 历史记录功能
- 更多风格预设
- 批量图像生成

## 贡献指南

欢迎提交 Pull Request 或创建 Issue 来改进此项目。

## 许可证

MIT
