// 主应用初始化
document.addEventListener('DOMContentLoaded', () => {
  // 检查所有必要的DOM元素是否存在
  function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
      console.error(`Element with id ${id} not found`);
    }
    return element;
  }
  
  // DOM Elements
  const dropArea = getElement('drop-area');
  const fileInput = getElement('file-input');
  const previewContainer = getElement('preview-container');
  const previewImage = getElement('preview-image');
  const removeImageBtn = getElement('remove-image');
  const uploadForm = getElement('upload-form');
  const generateBtn = getElement('generate-btn');
  const generateBtnText = getElement('generate-btn-text');
  const promptInput = getElement('prompt');
  const resultContainer = getElement('result-container');
  const originalImage = getElement('original-image');
  const originalImageBox = getElement('original-image-box');
  const comparisonContainer = getElement('comparison-container');
  const resultContent = getElement('result-content');
  const newGenerationBtn = getElement('new-generation');
  const loadingIndicator = getElement('loading');
  const loadingStatus = getElement('loading-status');
  const errorContainer = getElement('error-container');
  const errorMessage = getElement('error-message');
  const errorCloseBtn = getElement('error-close');
  const presetButtons = document.querySelectorAll('.preset-btn');
  const generatedImageContainer = getElement('generated-image-container');
  const generatedImage = getElement('generated-image');
  const downloadImageBtn = getElement('download-image');
  const previewImageBtn = getElement('preview-image-btn');
  
  // 模式切换元素
  const imageToImageTab = getElement('image-to-image-tab');
  const textToImageTab = getElement('text-to-image-tab');
  const imageToImageMode = getElement('image-to-image-mode');
  const textToImageMode = getElement('text-to-image-mode');
  const imageStylePresets = getElement('image-style-presets');
  const textStylePresets = getElement('text-style-presets');
  
  // 初始化时隐藏生成图像容器
  if (generatedImageContainer) {
    generatedImageContainer.style.display = 'none';
  }
  
  // 提示词翻译函数，用于将英文提示词转换为中文
  async function translatePrompt(prompt) {
    try {
      // 使用正则表达式检查是否包含英文字符
      if (!prompt || !prompt.match(/[a-zA-Z]/)) {
        return null; // 如果不包含英文，不需要翻译
      }
      
      // 模拟翻译结果（如果没有后端翻译API）
      // 注意：在实际应用中，应该调用后端翻译API
      
      // 常见英文提示词的翻译映射
      const translations = {
        'surreal': '超现实的',
        'deep-sea': '深海',
        'coral': '珊瑚',
        'fish': '鱼',
        'dreamlike': '梦幻般的',
        'otherworldly': '异世界的',
        'vibrant': '鲜艳的',
        'colorful': '多彩的',
        'vivid': '生动的',
        'imaginative': '充满想象力的',
        'ethereal': '空灵的',
        'intricate': '复杂的',
        'diverse': '多样化的',
        'swimming': '游泳',
        'scene': '场景'
      };
      
      // 简单的翻译逻辑，将英文单词替换为中文
      let translation = prompt;
      Object.keys(translations).forEach(key => {
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        translation = translation.replace(regex, translations[key]);
      });
      
      // 如果是文生图模式的提示词，添加翻译提示
      if (currentMode === 'text-to-image' && !translation.includes('生成一张')) {
        translation = `根据描述生成一张图像：${translation}`;
      }
      
      return translation;
      
      // 实际应用中的API调用代码（当前未使用）
      /*
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: prompt })
      });
      
      if (!response.ok) {
        throw new Error('翻译请求失败');
      }
      
      const data = await response.json();
      return data.translation;
      */
    } catch (error) {
      console.error('翻译错误:', error);
      return null;
    }
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
  
  // Variables for mode switching
  let currentMode = 'image-to-image'; // 默认模式：图生图
  
  // 模式切换事件
  if (imageToImageTab && textToImageTab) {
    imageToImageTab.addEventListener('click', () => switchMode('image-to-image'));
    textToImageTab.addEventListener('click', () => switchMode('text-to-image'));
  } else {
    console.error('Mode tabs not found');
  }
  
  // 模式切换函数
  function switchMode(mode) {
    currentMode = mode;
    console.log('切换模式为:', mode);
    
    // 检查所有必要的元素存在
    if (!imageToImageTab || !textToImageTab || !imageToImageMode || !textToImageMode || 
        !imageStylePresets || !textStylePresets || !generateBtnText || !promptInput) {
      console.error('Missing required elements for mode switching');
      return;
    }
    
    // 更新标签页状态
    if (mode === 'image-to-image') {
      imageToImageTab.classList.add('active');
      textToImageTab.classList.remove('active');
      imageToImageMode.style.display = 'block';
      textToImageMode.style.display = 'none';
      imageStylePresets.style.display = 'block';
      textStylePresets.style.display = 'none';
      generateBtnText.textContent = '生成图像';
      if (promptInput.hasAttribute('data-image-placeholder')) {
        promptInput.placeholder = promptInput.getAttribute('data-image-placeholder');
      }
    } else {
      imageToImageTab.classList.remove('active');
      textToImageTab.classList.add('active');
      imageToImageMode.style.display = 'none';
      textToImageMode.style.display = 'block';
      imageStylePresets.style.display = 'none';
      textStylePresets.style.display = 'block';
      generateBtnText.textContent = '生成图像';
      if (promptInput.hasAttribute('data-text-placeholder')) {
        promptInput.placeholder = promptInput.getAttribute('data-text-placeholder');
      }
    }
    
    // 更新比较容器的显示状态
    updateComparisonContainer();
    
    // 重置生成按钮状态
    if (typeof updateGenerateButtonState === 'function') {
      updateGenerateButtonState();
    }
    
    // 重置表单验证
    checkFormValidity();
  }

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
  
  // 为生成按钮添加点击事件，直接触发表单提交
  if (generateBtn) {
    console.log('添加生成按钮点击事件');
    generateBtn.addEventListener('click', function(e) {
      console.log('生成按钮被点击');
      // 直接触发表单提交事件，而不是调用handleSubmit函数
      if (uploadForm) {
        console.log('触发表单提交事件');
        // 创建并触发一个提交事件
        const submitEvent = new Event('submit', {
          bubbles: true,
          cancelable: true
        });
        uploadForm.dispatchEvent(submitEvent);
      }
    });
  }

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
    // 根据当前模式检查表单有效性
    let isValid = false;
    
    if (currentMode === 'image-to-image') {
      // 图生图模式：需要图片和提示词
      isValid = selectedFile && promptInput.value.trim();
    } else {
      // 文生图模式：只需要提示词
      isValid = promptInput.value.trim().length >= 5; // 至少需要5个字符的提示词
    }
    
    generateBtn.disabled = !isValid;
    
    // 添加颜色反馈，使按钮状态更明显
    if (isValid) {
      generateBtn.classList.add('active');
    } else {
      generateBtn.classList.remove('active');
    }
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
    // 根据当前模式更新比较容器
    updateComparisonContainer();
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
                if (data.content.originalImage) {
                  originalImagePath = data.content.originalImage;
                  originalImage.src = originalImagePath;
                }
                updateProgress(50, '正在生成图像...', 60);
              } else if (data.type === 'content') {
                // 内容块
                const content = data.content;
                if (content) {
                  // 添加到完整内容
                  fullContent += content;
                  
                  // 尝试提取进度信息
                  const progressMatch = content.match(/>进度\s*\*\*(\d+)%\*\*/i);
                  if (progressMatch && progressMatch[1]) {
                    const progressValue = parseInt(progressMatch[1], 10);
                    if (!isNaN(progressValue)) {
                      progress.update(progressValue);
                    }
                  }
                }
              } else if (data.type === 'error') {
                // 错误信息
                console.error('收到错误信息:', data.content);
                
                // 如果是积分不足错误，显示特定提示
                if (data.content.message && data.content.message.includes('积分不足')) {
                  const requiredCredits = data.content.requiredCredits || 1;
                  const currentCredits = data.content.currentCredits || 0;
                  const creditsNeeded = data.content.creditsNeeded || (requiredCredits - currentCredits);
                  
                  showError(`积分不足！需要 ${requiredCredits} 积分，您当前只有 ${currentCredits} 积分。还需要 ${creditsNeeded} 积分。请前往个人中心充值。`);
                } else {
                  // 其他错误
                  showError(data.content.message || '生成图像时出现错误');
                }
                
                // 重置进度条和加载状态
                progress.reset();
                setTimeout(() => {
                  loadingIndicator.style.display = 'none';
                }, 1000);
                
                // 终止流式连接
                if (eventSource) {
                  eventSource.close();
                }
              } else if (data.type === 'result') {
                // 最终结果
                generatedImageUrl = data.content.generatedImageUrl;
                console.log('收到生成的图像 URL:', generatedImageUrl);
                
                // 提取API返回的提示词和用户输入的提示词
                const apiPrompt = data.content.apiPrompt;
                const userPrompt = data.content.userPrompt || originalPrompt;
                
                console.log('API返回的提示词:', apiPrompt);
                console.log('用户输入的提示词:', userPrompt);
                
                // 立即将图像 URL 设置到图像元素
                if (generatedImageUrl && generatedImage) {
                  generatedImage.src = generatedImageUrl;
                  if (downloadImageBtn) {
                    downloadImageBtn.href = generatedImageUrl;
                    downloadImageBtn.download = 'generated-image.jpg';
                  }
                  
                  // 显示图像容器
                  if (generatedImageContainer) {
                    generatedImageContainer.style.display = 'block';
                  }
                  
                  // 设置下载和预览功能
                  setupImageDownload(generatedImageUrl);
                }
                
                // 显示提示词信息 - 使用API返回的提示词
                displayPromptInfo(apiPrompt, userPrompt);
                
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
      
      // 处理生成的图像 - 在流式响应结束后再次确认图像已经显示
      if (generatedImageUrl) {
        console.log('流式响应结束，确认图像 URL:', generatedImageUrl);
        
        // 再次确认图像元素已设置
        if (generatedImage && (!generatedImage.src || generatedImage.src === '#' || generatedImage.src === 'about:blank')) {
          generatedImage.src = generatedImageUrl;
        }
        
        if (downloadImageBtn) {
          downloadImageBtn.href = generatedImageUrl;
          downloadImageBtn.download = 'generated-image.jpg';
        }
        
        // 设置下载和预览功能
        setupImageDownload(generatedImageUrl);
        
        // 确保图像容器可见
        if (generatedImageContainer) {
          generatedImageContainer.style.display = 'block';
        }
        
        // 不需要再次显示提示词信息，因为已经在result事件中处理了
      } else {
        // 如果没有图像 URL
        console.log('流式响应结束，但没有收到图像 URL，尝试重新生成');
        
        // 尝试使用原始图像作为占位，如果有的话
        if (originalImagePath && originalImage && originalImage.src) {
          generatedImageUrl = originalImage.src;
          console.log('使用原始图像作为占位:', generatedImageUrl);
          
          if (generatedImage) {
            generatedImage.src = generatedImageUrl;
          }
          
          if (downloadImageBtn) {
            downloadImageBtn.href = generatedImageUrl;
            downloadImageBtn.download = 'generated-image.jpg';
          }
          
          if (generatedImageContainer) {
            generatedImageContainer.style.display = 'block';
          }
          
          // 设置下载和预览功能
          setupImageDownload(generatedImageUrl);
        } else {
          // 如果没有原始图像，显示错误信息
          if (generatedImageContainer) {
            generatedImageContainer.style.display = 'none';
          }
          if (resultContent) {
            resultContent.style.display = 'block';
            resultContent.innerHTML = '生成成功，但无法获取图像。请尝试使用不同的提示词或模型重新生成。';
          }
        }
      }
      
      // 完成进度
      progress.complete();
      
      // 显示结果容器
      if (uploadForm && uploadForm.parentElement) {
        uploadForm.parentElement.hidden = true;
      }
      if (resultContainer) {
        resultContainer.hidden = false;
      }
      
      // 添加调试信息
      console.log('流式响应完成，结果容器显示状态:', !resultContainer.hidden);
      console.log('图像容器显示状态:', generatedImageContainer.style.display);
      console.log('图像 URL:', generatedImage.src);
      
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

    // 根据当前模式验证表单
    if (currentMode === 'image-to-image' && !selectedFile) {
      alert('请选择一个图片文件！');
      return;
    }
    
    if (!promptInput.value.trim()) {
      alert('请输入提示词！');
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
      formData.append('prompt', prompt);
      formData.append('model', selectedModel); // 添加选择的模型
      formData.append('mode', currentMode); // 添加当前模式
      
      // 图生图模式才添加图片
      if (currentMode === 'image-to-image' && selectedFile) {
        formData.append('image', selectedFile);
      }
      
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
    // 显示错误信息
    errorMessage.textContent = message || '生成图像时出现错误';
    errorContainer.style.display = 'block';
    
    // 重置表单状态，确保用户可以重新尝试
    uploadForm.parentElement.hidden = false;
    resultContainer.hidden = true;
  }
  
  function resetForm() {
    // Reset form elements
    removeImage();
    promptInput.value = '';
    resultContainer.hidden = true;
    uploadForm.parentElement.hidden = false;
    
    // 重置预设按钮的活跃状态
    presetButtons.forEach(btn => btn.classList.remove('active'));
    
    // 重置生成按钮状态
    generateBtn.disabled = true;
    generateBtn.classList.remove('active');
    
    // 清空结果内容
    resultContent.textContent = '';
    resultContent.style.display = 'none';
    
    // 隐藏生成的图像容器
    generatedImageContainer.style.display = 'none';
    
    // 隐藏提示词显示区域
    const promptDisplay = document.getElementById('prompt-display');
    if (promptDisplay) {
      promptDisplay.style.display = 'none';
    }
    
    // 根据当前模式设置比较容器
    updateComparisonContainer();
  }
  
  // 更新比较容器的显示状态
  function updateComparisonContainer() {
    if (!originalImageBox || !comparisonContainer) {
      console.error('Missing comparison container elements');
      return;
    }
    
    if (currentMode === 'text-to-image') {
      // 文生图模式：隐藏原始图像，显示单图模式
      originalImageBox.style.display = 'none';
      comparisonContainer.classList.add('single-image-mode');
    } else {
      // 图生图模式：显示原始图像，移除单图模式
      originalImageBox.style.display = 'block';
      comparisonContainer.classList.remove('single-image-mode');
    }
  }
  
  // 显示提示词信息
  function displayPromptInfo(apiPrompt, userPrompt) {
    const originalPromptDisplay = document.getElementById('original-prompt-display');
    const translatedPromptDisplay = document.getElementById('translated-prompt-display');
    const promptDisplay = document.getElementById('prompt-display');
    
    if (!originalPromptDisplay || !promptDisplay) {
      console.error('Missing prompt display elements');
      return;
    }
    
    // 显示API返回的英文提示词
    if (apiPrompt) {
      originalPromptDisplay.innerHTML = `<strong>AI生成的描述：</strong> ${apiPrompt}`;
      originalPromptDisplay.style.display = 'block';
    } else {
      originalPromptDisplay.style.display = 'none';
    }
    
    // 显示用户输入的提示词或翻译
    if (userPrompt && translatedPromptDisplay) {
      // 如果是中文提示词，直接显示
      if (!userPrompt.match(/[a-zA-Z]/) || userPrompt.match(/[一-龥]/)) {
        translatedPromptDisplay.innerHTML = `<strong>原始提示词：</strong> ${userPrompt}`;
        translatedPromptDisplay.style.display = 'block';
      } else if (apiPrompt) {
        // 如果有API提示词，尝试翻译
        translatePrompt(apiPrompt).then(translation => {
          if (translation) {
            translatedPromptDisplay.innerHTML = `<strong>翻译：</strong> ${translation}`;
            translatedPromptDisplay.style.display = 'block';
          }
        }).catch(err => {
          console.error('翻译错误:', err);
          // 如果翻译失败，显示原始用户提示词
          translatedPromptDisplay.innerHTML = `<strong>原始提示词：</strong> ${userPrompt}`;
          translatedPromptDisplay.style.display = 'block';
        });
      } else {
        // 没有API提示词，显示用户提示词
        translatedPromptDisplay.innerHTML = `<strong>原始提示词：</strong> ${userPrompt}`;
        translatedPromptDisplay.style.display = 'block';
      }
    }
    
    // 显示提示词区域
    promptDisplay.style.display = 'block';
  }
  
  // 添加新生成按钮的事件处理
  // 使用已经在前面声明的newGenerationBtn常量
  if (newGenerationBtn) {
    newGenerationBtn.addEventListener('click', () => {
      resetForm();
      // 重置到上传表单状态
      uploadForm.parentElement.hidden = false;
      resultContainer.hidden = true;
    });
  }
  
  // 初始化模式 - 在所有函数定义完成后调用
  // 确保所有必要元素存在后再初始化
  if (imageToImageTab && textToImageTab && imageToImageMode && textToImageMode) {
    switchMode('image-to-image');
    updateComparisonContainer();
    console.log('Mode initialization completed');
  } else {
    console.error('Cannot initialize modes: missing required elements');
  }
});
