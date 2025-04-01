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
      
      console.log('Preset button clicked, prompt set to:', prompt);
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
    
    console.log('Form validity checked:', isValid, 'selectedFile:', !!selectedFile, 'promptInput:', !!promptInput.value.trim());
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
      console.log('Image loaded, checking form validity');
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

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!selectedFile || !promptInput.value.trim()) {
      return;
    }

    // Show loading indicator with message
    loadingIndicator.style.display = 'flex';
    loadingIndicator.querySelector('p').textContent = '正在生成中，请稍候...';
    loadingStatus.textContent = '准备中...';
    
    // Create form data
    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('prompt', promptInput.value.trim());
    
    try {
      console.log('发送图像生成请求...');
      loadingStatus.textContent = '正在处理图像并发送到 API...';
      
      // 设置超时时间为 10 分钟
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10分钟超时
      
      try {
        const response = await fetch('/api/generate-image', {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });
        
        // 请求完成后清除超时定时器
        clearTimeout(timeoutId);
      
        if (!response.ok) {
          const errorText = await response.text();
          console.error('服务器响应错误:', response.status, errorText);
          throw new Error(`服务器错误: ${response.status} ${response.statusText}`);
        }
      
        console.log('接收到服务器响应');
        loadingStatus.textContent = '收到响应，正在处理结果...';
        const data = await response.json();
        console.log('响应数据:', data);
      
        if (data.success) {
          // Display results
          originalImage.src = data.originalImage;
          
          // 清空之前的内容
          resultContent.innerHTML = '';
          
          if (data.result) {
            // 处理结果，检查是否包含图像 URL
            const result = data.result;
            // 不显示文字内容，只保留图像
            resultContent.innerHTML = ''; // 清空文字内容
            
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
                  console.error('转换图像格式失败:', err);
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
                console.error('加载图像失败');
                // 加载失败时使用原始 URL
                generatedImage.src = imageUrl;
                downloadImageBtn.href = imageUrl;
                generatedImageContainer.style.display = 'block';
              };
              
              // 开始加载图像
              img.src = imageUrl;
            } else {
              // 如果没有找到图像 URL
              generatedImageContainer.style.display = 'none';
              resultContent.textContent = '生成成功，但无法提取图像。';
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
        // 内部 catch 块处理内部错误
        throw error; // 将错误传递给外部 catch 块
      }
    } catch (error) {
      console.error('错误详情:', error);
      
      // 清除超时定时器，防止内存泄漏
      clearTimeout(timeoutId);
      
      let errorMsg = error.message;
      if (error.name === 'AbortError') {
        errorMsg = '生成图像超时（超过 10 分钟），请稍后再试。';
      }
      
      // 显示错误弹窗而不是 alert
      if (errorMsg) {
        errorMessage.textContent = errorMsg;
        errorContainer.style.display = 'block';
      }
    } finally {
      // Hide loading indicator
      loadingIndicator.style.display = 'none';
    }
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
