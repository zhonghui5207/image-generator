// 主应用初始化
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const dropArea = document.getElementById('drop-area');
  const fileInput = document.getElementById('file-input');
  const previewContainer = document.getElementById('preview-container');
  const previewImage = document.getElementById('preview-image');
  const removeImageBtn = document.getElementById('remove-image');
  const uploadForm = document.getElementById('upload-form');
  const generateBtn = document.getElementById('generate-btn');
  const promptInput = document.getElementById('prompt');
  const resultContainer = document.getElementById('result-container');
  const originalImage = document.getElementById('original-image');
  const resultContent = document.getElementById('result-content');
  const newGenerationBtn = document.getElementById('new-generation');
  const loadingIndicator = document.getElementById('loading');
  const loadingStatus = document.getElementById('loading-status');
  const errorContainer = document.getElementById('error-container');
  const errorMessage = document.getElementById('error-message');
  const errorCloseBtn = document.getElementById('error-close');
  const presetButtons = document.querySelectorAll('.preset-btn');
  const generatedImageContainer = document.getElementById('generated-image-container');
  const generatedImage = document.getElementById('generated-image');
  const downloadImageBtn = document.getElementById('download-image');
  const previewImageBtn = document.getElementById('preview-image-btn');
  
  // 初始化时隐藏生成图像容器
  if (generatedImageContainer) {
    generatedImageContainer.style.display = 'none';
  }
  
  // 从服务器获取最新的用户信息
  async function fetchUserProfile() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) return;
    
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // 更新本地存储的用户信息
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // 更新页面上的积分显示
        const creditsAmount = document.getElementById('credits-amount');
        if (creditsAmount && data.user.credits !== undefined) {
          creditsAmount.textContent = data.user.credits;
        }
      } else if (response.status === 401) {
        // 如果认证失败（token过期等），清除本地存储
        localStorage.removeItem('user');
        // 刷新页面以更新UI状态
        window.location.reload();
      }
    } catch (error) {
      // console.error('获取用户信息失败:', error);
    }
  }

  // Variables
  let selectedFile = null;

  // Event Listeners
  dropArea.addEventListener('click', () => {
    if (!previewContainer.hidden) return;
    fileInput.click();
  });

  // File input change
  fileInput.addEventListener('change', handleFileSelect);

  // Drag and drop events
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false);
  });

  function highlight() {
    dropArea.classList.add('dragover');
  }

  function unhighlight() {
    dropArea.classList.remove('dragover');
  }

  dropArea.addEventListener('drop', handleDrop, false);

  // Remove image button
  removeImageBtn.addEventListener('click', removeImage);

  // Form submission
  uploadForm.addEventListener('submit', handleSubmit);

  // New generation button
  newGenerationBtn.addEventListener('click', resetForm);

  // Error close button
  errorCloseBtn.addEventListener('click', () => {
    errorContainer.style.display = 'none';
  });
  
  // 确保错误容器和加载指示器初始化时是隐藏的
  errorContainer.style.display = 'none';
  loadingIndicator.style.display = 'none';

  // Preset buttons
  presetButtons.forEach(button => {
    button.addEventListener('click', () => {
      const prompt = button.getAttribute('data-prompt');
      promptInput.value = prompt;
      
      // Remove active class from all buttons
      presetButtons.forEach(btn => btn.classList.remove('active'));
      
      // Add active class to clicked button
      button.classList.add('active');
      
      // 手动触发表单验证，确保预设按钮点击后重新检查表单有效性
      checkFormValidity();
      
      // 模拟 input 事件，触发任何依赖于 input 事件的处理程序
      const inputEvent = new Event('input', { bubbles: true });
      promptInput.dispatchEvent(inputEvent);
      
      // console.log('Preset button clicked, prompt set to:', prompt);
    });
  });

  // Check if form is valid
  function checkFormValidity() {
    // 确保生成按钮在满足条件时可点击
    const isValid = selectedFile && promptInput.value.trim();
    generateBtn.disabled = !isValid;
    
    // 添加颜色反馈，使按钮状态更明显
    if (isValid) {
      generateBtn.classList.add('active');
    } else {
      generateBtn.classList.remove('active');
    }
    
    // console.log('Form validity checked:', isValid, 'selectedFile:', !!selectedFile, 'promptInput:', !!promptInput.value.trim());
  }

  // Prompt input event
  promptInput.addEventListener('input', checkFormValidity);

  // Functions
  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      processFile(file);
    }
  }

  function handleDrop(e) {
    const dt = e.dataTransfer;
    const file = dt.files[0];
    if (file) {
      processFile(file);
    }
  }

  function processFile(file) {
    // Check if file is an image
    if (!file.type.match('image.*')) {
      alert('请上传图片文件！');
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('文件大小不能超过10MB！');
      return;
    }

    selectedFile = file;
    const reader = new FileReader();
    
    reader.onload = function(e) {
      previewImage.src = e.target.result;
      previewContainer.hidden = false;
      dropArea.querySelector('.upload-content').style.display = 'none';
      // 确保在图片加载后检查表单有效性
      setTimeout(checkFormValidity, 100); // 添加小延迟确保 DOM 更新
      // console.log('Image loaded, checking form validity');
    };
    
    reader.readAsDataURL(file);
  }

  function removeImage() {
    previewContainer.hidden = true;
    dropArea.querySelector('.upload-content').style.display = 'flex';
    fileInput.value = '';
    selectedFile = null;
    checkFormValidity();
  }

  // Functions for loading progress
  function updateProgress(percent, statusText, estimatedTime) {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const loadingStatus = document.getElementById('loading-status');
    const timeEstimate = document.getElementById('time-estimate');
    
    // 对百分比进行取整，避免小数
    const roundedPercent = Math.round(percent);
    
    if (progressBar) progressBar.style.width = `${roundedPercent}%`;
    if (progressText) progressText.textContent = `${roundedPercent}%`;
    if (loadingStatus && statusText) loadingStatus.textContent = statusText;
    
    // 显示预估时间
    if (timeEstimate && estimatedTime !== undefined) {
      if (estimatedTime === 0) {
        timeEstimate.style.display = 'none';
      } else {
        timeEstimate.style.display = 'block';
        timeEstimate.textContent = `预计剩余时间: ${estimatedTime}秒`;
      }
    }
  }
  
  // 模拟进度条 - 改进版，避免初始跳跃
  function simulateProgress() {
    let progressValue = 0;
    let intervalId = null;
    let startTime = Date.now();
    const totalEstimatedTime = 60; // 默认估计生成需要60秒
    let remainingTime = totalEstimatedTime;
    
    return {
      start: function() {
        startTime = Date.now();
        // 从5%开始，慢慢增加
        progressValue = 5;
        updateProgress(progressValue, '初始化中...', remainingTime);
        
        intervalId = setInterval(() => {
          // 计算已用时间和预估剩余时间
          const elapsedSeconds = (Date.now() - startTime) / 1000;
          const completionPercentage = progressValue / 100;
          
          // 根据当前进度，估计剩余时间
          // 如果进度为0，避免除以零
          if (completionPercentage > 0.05) {
            remainingTime = Math.round((elapsedSeconds / completionPercentage) * (1 - completionPercentage));
          } else {
            remainingTime = totalEstimatedTime;
          }
          
          // 控制进度增加速度，让进度更平滑
          let increment = 0;
          
          // 根据已经过的时间调整增量
          if (progressValue < 15) {
            // 前15%很慢，模拟初始化阶段
            increment = 0.1 + (Math.random() * 0.2);
          } else if (progressValue < 40) {
            // 15-40%稍快一些
            increment = 0.2 + (Math.random() * 0.3);
          } else if (progressValue < 70) {
            // 40-70%再稍快一些
            increment = 0.1 + (Math.random() * 0.2);
          } else if (progressValue < 85) {
            // 70-85%变慢，模拟最终处理阶段
            increment = 0.05 + (Math.random() * 0.1);
          }
          
          // 限制最大进度为85%，等待完成信号
          progressValue = Math.min(progressValue + increment, 85);
          
          // 根据不同进度阶段，显示不同状态消息
          let statusMessage = '生成中，请稍候...';
          if (progressValue < 15) {
            statusMessage = '正在连接服务器，请稍候...';
          } else if (progressValue < 40) {
            statusMessage = '正在处理图像，请稍候...';
          } else if (progressValue < 70) {
            statusMessage = '正在生成创意内容，请稍候...';
          } else {
            statusMessage = '即将完成，最终处理中...';
          }
          
          updateProgress(progressValue, statusMessage, remainingTime);
        }, 800); // 每800毫秒更新一次
      },
      
      update: function(percent) {
        // 更新进度，但不超过90%，留出完成的空间
        if (percent > progressValue && percent <= 90) {
          progressValue = percent;
          // 计算剩余时间
          const elapsedSeconds = (Date.now() - startTime) / 1000;
          const completionPercentage = progressValue / 100;
          if (completionPercentage > 0) {
            remainingTime = Math.round((elapsedSeconds / completionPercentage) * (1 - completionPercentage));
          }
          updateProgress(progressValue, '接收数据中...', remainingTime);
        }
      },
      
      complete: function() {
        clearInterval(intervalId);
        progressValue = 100;
        updateProgress(progressValue, '生成完成！', 0);
      },
      
      reset: function() {
        clearInterval(intervalId);
        progressValue = 0;
        updateProgress(0, '', 0);
      }
    };
  }
  
  // 提示词翻译函数，用于将英文提示词转换为中文
  function translatePrompt(prompt) {
    // 针对示例提示词的特定翻译
    if (prompt.includes("A group of diverse men in casual clothing") && prompt.includes("Studio Ghibli animation")) {
      return "一群穿着休闲服装的不同男性在户外汽车旁摆姿势，采用温暖柔和的色调和舒适友好的氛围，以吉卜力工作室动画风格呈现。图像应具有手绘、动画效果，柔和的光线、精致的细节和自然的环境。男性应该以温和、富有表现力的特征描绘，穿着现代休闲服装，带有轻松愉快的氛围。";
    }
    
    // 针对预设风格的翻译
    if (prompt.startsWith("将图片转换成")) {
      return prompt; // 这些已经是中文，无需翻译
    }
    
    // 如果是其他情况且是英文，返回一个通用提示（因为我们无法进行实时翻译）
    if (/[a-zA-Z]/.test(prompt) && prompt.length > 30) {
      return "生成图像的风格提示（原文为英文）";
    }
    
    return prompt; // 默认不翻译
  }

  // 修改下载图片的函数
  function setupImageDownload(imageUrl) {
    // 创建一个临时链接用于下载而非预览
    downloadImageBtn.onclick = function(e) {
      e.preventDefault();
      
      // 创建一个新图像对象来转换为JPEG格式（如果还不是的话）
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function() {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        try {
          // 转换为JPEG格式
          canvas.toBlob(function(blob) {
            // 创建一个下载链接
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'generated-image.jpg';
            document.body.appendChild(a);
            a.click();
            
            // 清理
            setTimeout(function() {
              document.body.removeChild(a);
              window.URL.revokeObjectURL(url);
            }, 100);
          }, 'image/jpeg', 0.9);
        } catch (err) {
          console.error('下载图片失败:', err);
          // 如果转换失败，尝试直接下载原始URL
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = imageUrl;
          a.download = 'generated-image.jpg';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      };
      
      img.onerror = function() {
        console.error('加载图像失败，尝试直接下载');
        // 直接尝试下载原始URL
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = imageUrl;
        a.download = 'generated-image.jpg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
      
      img.src = imageUrl;
    };
    
    // 预览按钮保持不变
    previewImageBtn.onclick = function(e) {
      e.preventDefault();
      window.open(imageUrl, '_blank');
    };
  }

  // 处理流式响应
  async function handleStreamResponse(formData) {
    try {
      // 创建进度对象
      const progress = simulateProgress();
      progress.start();
      
      // 展示加载界面
      const timeEstimateElement = document.createElement('div');
      timeEstimateElement.id = 'time-estimate';
      timeEstimateElement.className = 'time-estimate';
      loadingIndicator.appendChild(timeEstimateElement);
      
      updateProgress(10, '建立流式连接...', 60);
      
      // 创建 EventSource 对象连接服务器发送的事件流
      const formDataForUrl = new URLSearchParams();
      formDataForUrl.append('stream', 'true');
      
      // 使用 fetch 上传文件
      const uploadResponse = await fetch('/api/generate-image?stream=true', {
        method: 'POST',
        body: formData
      });
      
      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || '上传文件失败');
      }
      
      // 获取原始提示词
      const originalPrompt = promptInput.value.trim();
      
      // 创建用于显示结果的元素
      resultContent.style.display = 'none'; // 不显示完整内容
      const streamingContent = document.createElement('div');
      streamingContent.className = 'streaming-content';
      
      // 设置流式连接的处理函数
      const reader = uploadResponse.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let originalImagePath = '';
      let generatedImageUrl = '';
      
      updateProgress(40, '接收数据中...', 60);
      
      // 处理数据流
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // 解码数据
        const text = decoder.decode(value);
        const lines = text.split('\n\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              
              // 根据数据类型处理
              if (data.type === 'info') {
                // 初始信息
                originalImagePath = data.content.originalImage;
                originalImage.src = originalImagePath;
                updateProgress(50, '正在生成图像...', 60);
              } else if (data.type === 'content') {
                // 流式内容
                fullContent += data.content;
                // 不显示内容
              } else if (data.type === 'result') {
                // 最终结果
                generatedImageUrl = data.content.generatedImageUrl;
                
                // 更新用户积分
                if (data.content.credits) {
                  const user = JSON.parse(localStorage.getItem('user') || '{}');
                  user.credits = data.content.credits.remaining;
                  localStorage.setItem('user', JSON.stringify(user));
                  
                  // 更新页面上的积分显示
                  const creditsAmount = document.getElementById('credits-amount');
                  if (creditsAmount) {
                    creditsAmount.textContent = data.content.credits.remaining;
                  }
                }
                
                updateProgress(90, '处理生成的图像...', 60);
              }
            } catch (e) {
              console.error('解析数据错误:', e);
            }
          }
        }
      }
      
      // 处理生成的图像
      if (generatedImageUrl) {
        // 将图像 URL 设置到图像元素
        generatedImage.src = generatedImageUrl;
        downloadImageBtn.href = generatedImageUrl;
        downloadImageBtn.download = 'generated-image.jpg';
        
        // 设置下载和预览功能
        setupImageDownload(generatedImageUrl);
        
        // 显示图像容器
        generatedImageContainer.style.display = 'block';
      } else {
        // 如果没有图像 URL
        generatedImageContainer.style.display = 'none';
        resultContent.innerHTML = '生成成功，但无法提取图像。';
      }
      
      // 完成进度
      progress.complete();
      
      // 显示结果容器
      uploadForm.parentElement.hidden = true;
      resultContainer.hidden = false;
      
    } catch (error) {
      console.error('流式响应错误:', error);
      showError(error.message || '处理流式响应时出错');
    } finally {
      // 延迟隐藏加载指示器
      setTimeout(() => {
        loadingIndicator.style.display = 'none';
      }, 1000);
    }
  }
  
  async function handleSubmit(e) {
    e.preventDefault();

    if (!selectedFile) {
      alert('请选择一个图片文件！');
      return;
    }

    // 显示加载状态
    uploadForm.parentElement.hidden = true;
    loadingIndicator.style.display = 'flex';
    updateProgress(5, '准备上传文件...', 60);

    // 获取用户提示词
    const prompt = promptInput.value.trim() || '将图片转换成创意风格';
    
    // 获取选择的模型
    const selectedModel = document.querySelector('input[name="model"]:checked').value;
    
    // 确定消耗的积分数量
    let creditsToUse = 1; // 默认消耗1积分
    if (selectedModel === 'gpt-4o-image-vip') {
      creditsToUse = 2; // VIP模型消耗2积分
    }
    
    // 检查用户积分是否足够
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (user && user.credits < creditsToUse) {
      showError(`积分不足！${selectedModel === 'gpt-4o-image-vip' ? 'VIP模型需要2积分' : '生成图像需要1积分'}，您当前只有 ${user.credits} 积分。`);
      uploadForm.parentElement.hidden = false;
      loadingIndicator.style.display = 'none';
      return;
    }

    try {
      // 创建FormData对象
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('prompt', prompt);
      formData.append('model', selectedModel); // 添加选择的模型
      
      // 创建进度对象
      const progress = simulateProgress();
      progress.start();

      // 检查是否使用流式响应
      const useStream = true; // 默认使用流式响应
      
      if (useStream) {
        // 使用流式响应处理
        await handleStreamResponse(formData);
        return;
      }
      
      // 非流式响应处理（原有方式）
      updateProgress(20, '上传图片中...', 60);

      // 发送请求到服务器
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        body: formData
      });

      updateProgress(50, '图片已上传，正在生成中...', 60);

      const data = await response.json();

      if (data.success) {
        // 进度跳跃到90%
        updateProgress(90, '生成成功，处理结果中...', 0);
        
        // 更新用户积分（从响应中获取或重新获取用户信息）
        if (data.updatedCredits !== undefined) {
          // 如果API返回了更新后的积分
          const user = JSON.parse(localStorage.getItem('user') || '{}');
          user.credits = data.updatedCredits;
          localStorage.setItem('user', JSON.stringify(user));
          
          // 更新页面上的积分显示
          const creditsAmount = document.getElementById('credits-amount');
          if (creditsAmount) {
            creditsAmount.textContent = data.updatedCredits;
          }
        } else {
          // 如果API没有返回积分，则刷新用户信息
          fetchUserProfile();
        }
        
        // Display results
        originalImage.src = data.originalImage;
        
        // 显示原始提示词
        const originalPromptDisplay = document.getElementById('original-prompt-display');
        if (originalPromptDisplay) {
          originalPromptDisplay.textContent = prompt;
        }
        
        // 清空之前的内容
        resultContent.style.display = 'none';
        
        if (data.result) {
          // 处理结果，检查是否包含图像 URL
          const result = data.result;
          
          // 检查是否包含速率限制或其他错误信息
          if (result.includes('rate limit') || result.includes('I can\'t create') || result.includes('can\'t generate')) {
            // 显示速率限制错误
            showError('生成图像失败: API 达到速率限制。\n\n错误信息: ' + result);
            return;
          }
          
          // 尝试提取图像 URL
          const imgUrlMatch = result.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/i) || 
                              result.match(/\bhttps?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp)\b/i);
          
          if (imgUrlMatch && imgUrlMatch[1]) {
            // 如果找到图像 URL
            const imageUrl = imgUrlMatch[1];
            
            // 将 WebP 图像转换为 JPEG
            // 创建一个新的图像对象来加载 URL
            const img = new Image();
            img.crossOrigin = 'anonymous'; // 允许跨域加载
            img.onload = function() {
              // 创建画布并绘制图像
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              
              // 将画布转换为 JPEG 格式的 DataURL
              try {
                const jpegUrl = canvas.toDataURL('image/jpeg', 0.9);
                
                // 更新图像和下载链接
                generatedImage.src = jpegUrl;
                downloadImageBtn.href = jpegUrl;
                downloadImageBtn.download = 'generated-image.jpg'; // 设置下载文件名
                
                // 设置下载和预览功能
                setupImageDownload(jpegUrl);
                
                // 显示图像容器
                generatedImageContainer.style.display = 'block';
              } catch (err) {
                // 如果转换失败，回退到原始 URL
                generatedImage.src = imageUrl;
                
                // 设置下载和预览功能
                setupImageDownload(imageUrl);
                
                // 显示图像容器
                generatedImageContainer.style.display = 'block';
              }
            };
            
            img.onerror = function() {
              // console.error('加载图像失败');
              // 加载失败时使用原始 URL
              generatedImage.src = imageUrl;
              
              // 设置下载和预览功能
              setupImageDownload(imageUrl);
              
              // 显示图像容器
              generatedImageContainer.style.display = 'block';
            };
            
            // 开始加载图像
            img.src = imageUrl;
          } else {
            // 如果没有找到图像 URL
            // 检查结果中是否包含错误信息
            if (result.length > 50) { // 如果结果文本较长，可能是错误信息
              showError('生成图像失败: API 返回了文本而非图像\n\n返回内容: ' + result.substring(0, 200) + '...');
              return;
            } else {
              generatedImageContainer.style.display = 'none';
              resultContent.textContent = '生成成功，但无法提取图像。';
            }
          }
        } else {
          resultContent.textContent = '生成成功，但没有返回内容。';
          generatedImageContainer.style.display = 'none';
        }
        
        // Show result container
        uploadForm.parentElement.hidden = true;
        resultContainer.hidden = false;
      } else {
        throw new Error(data.error || '生成失败');
      }
    } catch (error) {
      // console.error('错误详情:', error);
      
      // 重置进度条
      progress.reset();
      
      let errorMsg = error.message;
      if (error.name === 'AbortError') {
        errorMsg = '生成图像超时（超过 10 分钟），请稍后再试。';
      }
      
      // 使用增强版错误处理函数
      if (errorMsg) {
        showError(errorMsg);
      }
    } finally {
      // 延迟隐藏加载指示器，给用户时间看到进度条完成或错误状态
      setTimeout(() => {
        loadingIndicator.style.display = 'none';
      }, 1000);
    }
  }

  // 增强版错误处理函数
  function showError(message) {
    // console.error('错误:', message);
    
    // 重置进度条（如果存在）
    if (typeof progress !== 'undefined' && progress && typeof progress.reset === 'function') {
      progress.reset();
    }
    
    // 隐藏加载指示器
    loadingIndicator.style.display = 'none';
    
    // 显示错误信息
    errorMessage.textContent = message;
    errorContainer.style.display = 'block';
    
    // 重置表单状态，确保用户可以重新尝试
    uploadForm.parentElement.hidden = false;
    resultContainer.hidden = true;
  }
  
  function resetForm() {
    // Reset form
    uploadForm.reset();
    removeImage();
    
    // Reset preset buttons
    presetButtons.forEach(btn => btn.classList.remove('active'));
    
    // 重置生成的图像容器
    generatedImageContainer.style.display = 'none';
    generatedImage.src = '#';
    downloadImageBtn.href = '#';
    
    // Show upload form and hide result
    uploadForm.parentElement.hidden = false;
    resultContainer.hidden = true;
  }
});
