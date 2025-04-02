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
  function updateProgress(percent, statusText) {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const loadingStatus = document.getElementById('loading-status');
    
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (progressText) progressText.textContent = `${percent}%`;
    if (loadingStatus && statusText) loadingStatus.textContent = statusText;
  }
  
  // 模拟进度条
  function simulateProgress() {
    let progressValue = 0;
    let intervalId = null;
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    
    return {
      start: function() {
        progressValue = 5;
        updateProgress(progressValue, '初始化中...');
        
        intervalId = setInterval(() => {
          // 控制进度增加速度，中间段较慢
          let increment = 0;
          if (progressValue < 30) {
            increment = Math.random() * 2; // 开始阶段快一些
          } else if (progressValue < 60) {
            increment = Math.random() * 1; // 中间阶段慢一些
          } else if (progressValue < 85) {
            increment = Math.random() * 0.5; // 接近完成时更慢
          }
          
          progressValue = Math.min(progressValue + increment, 85);
          updateProgress(progressValue, '生成中，请稍候...');
        }, 800); // 每800毫秒更新一次
      },
      
      complete: function() {
        clearInterval(intervalId);
        progressValue = 100;
        updateProgress(progressValue, '生成完成！');
      },
      
      reset: function() {
        clearInterval(intervalId);
        progressValue = 0;
        updateProgress(0, '');
      }
    };
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
    updateProgress(5, '准备上传文件...');

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

      updateProgress(20, '上传图片中...');

      // 发送请求到服务器
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        body: formData
      });

      updateProgress(50, '图片已上传，正在生成中...');

      const data = await response.json();

      if (data.success) {
        // 进度跳跃到90%
        updateProgress(90, '生成成功，处理结果中...');
        
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
        
        // 清空之前的内容
        resultContent.innerHTML = '';
        
        if (data.result) {
          // 处理结果，检查是否包含图像 URL
          const result = data.result;
          // 不显示文字内容，只保留图像
          resultContent.innerHTML = ''; // 清空文字内容
          
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
                
                // 正确设置预览功能，新标签页打开
                previewImageBtn.onclick = function(e) {
                  e.preventDefault(); // 防止默认行为
                  window.open(jpegUrl, '_blank');
                };
              } catch (err) {
                // console.error('转换图像格式失败:', err);
                // 如果转换失败，回退到原始 URL
                generatedImage.src = imageUrl;
                downloadImageBtn.href = imageUrl;
                previewImageBtn.onclick = function(e) {
                  e.preventDefault();
                  window.open(imageUrl, '_blank');
                };
              }
              
              // 显示图像容器
              generatedImageContainer.style.display = 'block';
            };
            
            img.onerror = function() {
              // console.error('加载图像失败');
              // 加载失败时使用原始 URL
              generatedImage.src = imageUrl;
              downloadImageBtn.href = imageUrl;
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
