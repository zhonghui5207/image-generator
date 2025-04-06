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
  
  // 检查用户登录状态
  const token = localStorage.getItem('token');
  const isLoggedIn = !!token;
  
  // 获取URL参数
  const urlParams = new URLSearchParams(window.location.search);
  const redirectParam = urlParams.get('redirect');
  
  // 如果是从登录页重定向回来的，滚动到上传区域
  if (redirectParam === 'index' && isLoggedIn) {
    setTimeout(() => {
      const uploadContainer = document.querySelector('.upload-container');
      if (uploadContainer) {
        uploadContainer.scrollIntoView({ behavior: 'smooth' });
      }
    }, 500);
  }
  
  // 初始化时隐藏生成图像容器
  if (generatedImageContainer) {
    generatedImageContainer.style.display = 'none';
  }
  
  // Functions for loading display
  function updateLoadingStatus(statusText) {
    const loadingStatus = document.getElementById('loading-status');
    if (loadingStatus && statusText) loadingStatus.textContent = statusText;
  }

  // 简化的加载状态管理
  function manageLoadingState() {
    let intervalId = null;
    const loadingMessages = [
      '正在连接服务器，请稍候...',
      '正在处理图像，请稍候...',
      '正在生成创意内容，请稍候...',
      '即将完成，最终处理中...'
    ];
    let currentMessageIndex = 0;
    
    return {
      start: function() {
        // 显示第一条消息
        updateLoadingStatus(loadingMessages[0]);
        
        // 每5秒更换一条消息，轮流显示
        intervalId = setInterval(() => {
          currentMessageIndex = (currentMessageIndex + 1) % loadingMessages.length;
          updateLoadingStatus(loadingMessages[currentMessageIndex]);
        }, 5000);
      },
      
      complete: function() {
        clearInterval(intervalId);
        updateLoadingStatus('生成完成！');
      },
      
      reset: function() {
        clearInterval(intervalId);
        updateLoadingStatus('');
      }
    };
  }

  // 创建一个经过防抖处理的进度更新函数
  const debouncedProgressUpdate = debounce((progress, value) => {
    progress.update(value);
  }, 300); // 300ms 的防抖延迟

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
      console.error('获取用户信息失败:', error);
    }
  }

  // Functions for loading progress
  function updateProgress(percent, statusText) {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const loadingStatus = document.getElementById('loading-status');
    
    // 对百分比进行取整，避免小数
    const roundedPercent = Math.round(percent);
    
    if (progressBar) {
      // 确保 CSS 过渡效果生效
      progressBar.style.transition = 'width 0.8s ease-in-out';
      progressBar.style.width = `${roundedPercent}%`;
    }
    
    if (progressText) progressText.textContent = `${roundedPercent}%`;
    if (loadingStatus && statusText) loadingStatus.textContent = statusText;
  }

  // 模拟进度条 - 改进版，避免初始跳跃
  function simulateProgress() {
    let progressValue = 0;
    let intervalId = null;
    
    return {
      start: function() {
        // 从5%开始，慢慢增加
        progressValue = 5;
        updateProgress(progressValue, '初始化中...');
        
        intervalId = setInterval(() => {
          // 控制进度增加速度，让进度更平滑
          let increment = 0;
          
          // 使用固定增量
          if (progressValue < 15) {
            // 前15%很慢，模拟初始化阶段
            increment = 0.15;
          } else if (progressValue < 40) {
            // 15-40%稍快一些
            increment = 0.25;
          } else if (progressValue < 70) {
            // 40-70%再稍快一些
            increment = 0.15;
          } else if (progressValue < 85) {
            // 70-85%变慢，模拟最终处理阶段
            increment = 0.08;
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
          
          updateProgress(progressValue, statusMessage);
        }, 800); // 每800毫秒更新一次
      },
      
      update: function(percent) {
        // 防止进度条跳跃：如果服务器返回的进度小于当前模拟进度，则忽略
        if (percent > progressValue && percent <= 90) {
          // 添加平滑过渡，不要直接跳到新值
          const smoothIncrement = Math.min(2, (percent - progressValue) / 4);
          progressValue = progressValue + smoothIncrement;
          
          updateProgress(progressValue, '接收数据中...');
        }
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
    
    // 检查表单有效性，更新生成按钮状态
    setTimeout(checkFormValidity, 100); // 添加小延迟确保DOM更新完成
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
    // 根据当前模式验证表单，不检查登录状态
    let isValid = false;
    
    if (currentMode === 'image-to-image') {
      // 图生图模式：需要图片和提示词
      isValid = !!selectedFile && !!promptInput.value.trim();
    } else {
      // 文生图模式：只需要提示词
      isValid = !!promptInput.value.trim();
    }
    
    // 更新生成按钮状态
    if (generateBtn) {
      generateBtn.disabled = !isValid;
      
      // 添加颜色反馈，使按钮状态更明显
      if (isValid) {
        generateBtn.classList.add('active');
      } else {
        generateBtn.classList.remove('active');
      }
    }
    
    return isValid;
  }

  // Prompt input event
  promptInput.addEventListener('input', checkFormValidity);

  // Functions
  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      processFile(file);
      // 文件选择后检查表单有效性
      checkFormValidity();
    }
  }

  function handleDrop(e) {
    const dt = e.dataTransfer;
    const file = dt.files[0];
    if (file) {
      processFile(file);
      // 拖放文件后检查表单有效性
      checkFormValidity();
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
      
      // 确保在图片加载后重新检查表单有效性
      setTimeout(checkFormValidity, 100); // 添加小延迟确保DOM更新完成
    };
    
    reader.readAsDataURL(file);
  }

  function removeImage() {
    previewContainer.hidden = true;
    dropArea.querySelector('.upload-content').style.display = 'flex';
    fileInput.value = '';
    selectedFile = null;
    // 移除图片后检查表单有效性
    checkFormValidity();
  }

  // 添加一个简易的防抖函数辅助平滑进度更新
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }

  // 修改下载图片的函数
  function setupImageDownload(imageUrl) {
    // 检测是否为移动设备
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
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
            
            if (isMobile) {
              // 移动端设备处理方式 - 显示分享/保存选项
              if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                // iOS设备
                // 创建临时图片展示并长按保存
                const tempImg = document.createElement('div');
                tempImg.style.position = 'fixed';
                tempImg.style.top = '0';
                tempImg.style.left = '0';
                tempImg.style.width = '100%';
                tempImg.style.height = '100%';
                tempImg.style.backgroundColor = 'rgba(0,0,0,0.8)';
                tempImg.style.zIndex = '10000';
                tempImg.style.display = 'flex';
                tempImg.style.flexDirection = 'column';
                tempImg.style.alignItems = 'center';
                tempImg.style.justifyContent = 'center';
                
                const imgElement = document.createElement('img');
                imgElement.src = url;
                imgElement.style.maxWidth = '90%';
                imgElement.style.maxHeight = '80%';
                imgElement.style.objectFit = 'contain';
                
                const helpText = document.createElement('p');
                helpText.textContent = '长按图片保存到相册';
                helpText.style.color = 'white';
                helpText.style.marginTop = '20px';
                helpText.style.fontSize = '16px';
                
                const closeBtn = document.createElement('button');
                closeBtn.textContent = '关闭';
                closeBtn.style.marginTop = '20px';
                closeBtn.style.padding = '10px 20px';
                closeBtn.style.backgroundColor = '#4a6bdf';
                closeBtn.style.color = 'white';
                closeBtn.style.border = 'none';
                closeBtn.style.borderRadius = '5px';
                closeBtn.onclick = function() {
                  document.body.removeChild(tempImg);
                  window.URL.revokeObjectURL(url);
                };
                
                tempImg.appendChild(imgElement);
                tempImg.appendChild(helpText);
                tempImg.appendChild(closeBtn);
                document.body.appendChild(tempImg);
              } else {
                // Android设备
                // 使用Blob和FileSaver方式下载
                try {
                  const fileName = 'generated-image.jpg';
                  
                  // 使用navigator.share API如果可用
                  if (navigator.share) {
                    const file = new File([blob], fileName, { type: 'image/jpeg' });
                    navigator.share({
                      files: [file],
                      title: '柯达鸭生成的图像',
                    }).catch(err => {
                      console.log('分享失败，尝试其他方式下载', err);
                      window.open(url, '_blank');
                    });
                  } else {
                    // 回退到在新窗口打开图片
                    window.open(url, '_blank');
                  }
                } catch (err) {
                  console.error('Android设备下载失败:', err);
                  window.open(url, '_blank');
                }
              }
            } else {
              // 桌面设备的常规下载方式
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
            }
          }, 'image/jpeg', 0.9);
        } catch (err) {
          console.error('下载图片失败:', err);
          // 如果转换失败，为移动设备打开新窗口，为桌面设备使用链接下载
          if (isMobile) {
            window.open(imageUrl, '_blank');
          } else {
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = imageUrl;
            a.download = 'generated-image.jpg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
        }
      };
      
      img.onerror = function() {
        console.error('加载图像失败，尝试直接下载');
        // 直接尝试下载原始URL
        if (isMobile) {
          window.open(imageUrl, '_blank');
        } else {
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = imageUrl;
          a.download = 'generated-image.jpg';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
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
      updateProgress(10, '建立流式连接...');
      
      // 创建 EventSource 对象连接服务器发送的事件流
      const formDataForUrl = new URLSearchParams();
      formDataForUrl.append('stream', 'true');
      
      // 使用 fetch 上传文件
      const uploadResponse = await fetch('/api/generate-image?stream=true', {
        method: 'POST',
        body: formData
      });
      
      if (!uploadResponse.ok) {
        // 检查是否是401未授权错误（未登录）
        if (uploadResponse.status === 401) {
          console.log('用户未登录，重定向到登录页面');
          window.location.href = '/login.html?redirect=index';
          return;
        }
        
        // 尝试解析错误响应
        try {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || errorData.message || '上传文件失败');
        } catch (parseError) {
          // 如果JSON解析失败，可能是服务器返回了HTML错误页面
          console.error('解析错误响应失败:', parseError);
          
          // 尝试获取响应的文本内容
          const errorText = await uploadResponse.text();
          
          // 检查是否是登录相关错误
          if (errorText.includes('未登录') || errorText.includes('需要登录') || 
              errorText.includes('请登录') || errorText.includes('login required') ||
              errorText.includes('Unauthorized') || errorText.includes('401')) {
            console.log('检测到需要登录，重定向到登录页面');
            window.location.href = '/login.html?redirect=index';
            return;
          }
          
          // 检查是否为HTML内容（通常表示服务器错误）
          if (errorText.includes('<!DOCTYPE') || errorText.includes('<html')) {
            console.error('服务器返回了HTML错误页面:', errorText.substring(0, 200));
            throw new Error(`服务器错误 (状态码: ${uploadResponse.status}). 请稍后再试或联系管理员.`);
          } else {
            throw new Error(`上传文件失败 (状态码: ${uploadResponse.status}): ${errorText.substring(0, 100)}`);
          }
        }
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
      
      updateProgress(40, '接收数据中...');
      
      // 处理数据流
      try {
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
                  updateProgress(50, '正在生成图像...');
                } else if (data.type === 'content') {
                  // 内容块
                  const content = data.content;
                  if (content) {
                    // 添加到完整内容
                    fullContent += content;
                    
                    // 尝试提取进度信息 - 改进提取方法
                    const progressMatch = content.match(/>进度\s*\*\*(\d+)%\*\*/i);
                    if (progressMatch && progressMatch[1]) {
                      const progressValue = parseInt(progressMatch[1], 10);
                      if (!isNaN(progressValue)) {
                        // 使用防抖函数更新进度，避免频繁更新导致的跳跃
                        if (progressValue > 10) { // 只处理有意义的进度值
                          debouncedProgressUpdate(progress, progressValue);
                        }
                      }
                    }
                  }
                } else if (data.type === 'error') {
                  // 错误信息
                  console.error('收到错误信息:', data.content);
                  
                  // 检查是否是未登录或授权相关错误
                  if (data.content.message && 
                      (data.content.message.includes('未登录') || 
                       data.content.message.includes('需要登录') || 
                       data.content.message.includes('未授权') ||
                       data.content.message.includes('Unauthorized'))) {
                    console.log('用户未登录或会话已过期，重定向到登录页面');
                    window.location.href = '/login.html?redirect=index';
                    return;
                  }
                  
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
                  
                  // 立即隐藏加载指示器，不要延迟
                  loadingIndicator.style.display = 'none';
                  
                  // 重置表单状态，让用户可以重试
                  uploadForm.parentElement.hidden = false;
                  resultContainer.hidden = true;
                  
                  // 更新用户积分（如果错误响应中包含积分信息）
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
                  
                  // 终止处理，提前返回
                  return;
                } else if (data.type === 'result') {
                  // 最终结果
                  generatedImageUrl = data.content.generatedImageUrl;
                  console.log('收到生成的图像 URL:', generatedImageUrl);
                  console.log('完整的响应数据:', JSON.stringify(data.content));
                  
                  // 检查图像 URL是否有效
                  if (!generatedImageUrl || generatedImageUrl === 'null' || generatedImageUrl === 'undefined') {
                    console.warn('服务器返回的图像 URL无效:', generatedImageUrl);
                    // 尝试从完整响应中提取图像 URL
                    if (data.content.historyId) {
                      console.log('尝试使用历史ID构造图像 URL:', data.content.historyId);
                      // 使用历史ID构造一个图像 URL
                      generatedImageUrl = `/api/history/image/${data.content.historyId}`;
                    }
                  }
                  
                  // 提取API返回的提示词和用户输入的提示词
                  const apiPrompt = data.content.apiPrompt;
                  const userPrompt = data.content.userPrompt || originalPrompt;
                  
                  console.log('API返回的提示词:', apiPrompt);
                  console.log('用户输入的提示词:', userPrompt);
                  
                  // 立即将图像 URL 设置到图像元素
                  if (generatedImageUrl && generatedImage) {
                    generatedImage.onload = function() {
                      // 图像加载完成后检查并更新UI状态
                      checkAndUpdateUIState();
                    };
                    
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
                    
                    // 显示结果容器，隐藏上传表单
                    uploadForm.parentElement.hidden = true;
                    resultContainer.hidden = false;
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
                  
                  updateProgress(90, '处理生成的图像...');
                }
              } catch (e) {
                console.error('解析数据错误:', e, '原始数据:', line.substring(6));
                // 即使解析失败也继续处理其他数据
              }
            }
          }
        }
        
        // 如果流式响应结束但没有收到结果，显示错误
        if (!generatedImageUrl) {
          console.error('流式响应结束但未收到有效结果');
          showError('图像生成过程异常结束，请稍后重试');
          
          // 重置状态
          progress.reset();
          loadingIndicator.style.display = 'none';
          uploadForm.parentElement.hidden = false;
          resultContainer.hidden = true;
        }
      } catch (streamError) {
        console.error('流式处理错误:', streamError);
        showError('图像生成过程中断，请稍后重试');
        
        // 重置状态
        progress.reset();
        loadingIndicator.style.display = 'none';
        uploadForm.parentElement.hidden = false;
        resultContainer.hidden = true;
      }
    } catch (error) {
      console.error('流式请求错误:', error);
      showError(error.message || '无法建立流式连接，请稍后重试');
      
      // 重置状态
      progress?.reset();
      loadingIndicator.style.display = 'none';
      uploadForm.parentElement.hidden = false;
      resultContainer.hidden = true;
    } finally {
      // 如果生成成功，完成进度条
      if (generatedImageUrl) {
        updateProgress(100, '生成完成！');
        // 延迟隐藏加载指示器
        setTimeout(() => {
          loadingIndicator.style.display = 'none';
          // 不自动显示结果容器，等待图像加载完成后再显示
        }, 500);
      }
    }
  }
  
  // 处理表单提交 - 确保函数在全局范围内可用
  async function handleSubmit(e) {
    e.preventDefault();
    
    // 验证表单
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

  // 将handleSubmit设置为全局函数
  window.handleSubmit = handleSubmit;

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
    
    // 确保加载指示器隐藏
    loadingIndicator.style.display = 'none';
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
    
    // 初始化时检查表单状态
    checkFormValidity();
    
    console.log('Mode initialization completed');
  } else {
    console.error('Cannot initialize modes: missing required elements');
  }

  // 检查并更新界面状态，确保结果正确显示
  function checkAndUpdateUIState() {
    // 检查生成的图像是否有效
    const isGeneratedImageValid = generatedImage && generatedImage.src && 
                                  generatedImage.src !== '#' && 
                                  generatedImage.src !== 'about:blank' &&
                                  generatedImage.complete && 
                                  generatedImage.naturalWidth > 0;
    
    // 只有当图像有效且已经加载完成时才显示结果容器
    if (isGeneratedImageValid && resultContainer.hidden && 
        generatedImage.getAttribute('src').includes('generated')) {
      console.log('检测到有效的生成图像，显示结果');
      resultContainer.hidden = false;
      uploadForm.parentElement.hidden = true;
      
      // 确保图像容器可见
      if (generatedImageContainer) {
        generatedImageContainer.style.display = 'block';
      }
      
      // 隐藏加载指示器
      loadingIndicator.style.display = 'none';
    }
  }
});
