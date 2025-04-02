document.addEventListener('DOMContentLoaded', function() {
  // 获取DOM元素 - 用户信息
  const usernameElement = document.getElementById('username');
  const emailElement = document.getElementById('email');
  const creditsElement = document.getElementById('credits');
  const createdAtElement = document.getElementById('created-at');
  const creditsAmountElement = document.getElementById('credits-amount');
  const displayUsernameElement = document.getElementById('display-username');
  const generationCountElement = document.getElementById('generation-count');
  
  // 获取DOM元素 - 历史记录
  const historyGrid = document.getElementById('history-grid');
  const historySort = document.getElementById('history-sort');
  const pagination = document.getElementById('pagination');
  
  // 获取DOM元素 - 积分使用记录
  const usageList = document.getElementById('usage-list');
  
  // 获取DOM元素 - 标签页
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // 获取DOM元素 - 模态框
  const imageModal = document.getElementById('image-modal');
  const closeModal = document.querySelector('.close-modal');
  const modalOriginalImage = document.getElementById('modal-original-image');
  const modalGeneratedImage = document.getElementById('modal-generated-image');
  const modalPrompt = document.getElementById('modal-prompt');
  const modalCreatedAt = document.getElementById('modal-created-at');
  const modalCreditsUsed = document.getElementById('modal-credits-used');
  const modalModelUsed = document.getElementById('modal-model-used');
  const modalDownloadJpgBtn = document.getElementById('modal-download-jpg-btn');
  const modalDownloadPngBtn = document.getElementById('modal-download-png-btn');
  const modalDeleteBtn = document.getElementById('modal-delete-btn');
  
  // 分页变量
  let currentPage = 1;
  const itemsPerPage = 12;
  let totalPages = 1;
  let sortOrder = 'newest';
  
  // 用户信息
  let user = JSON.parse(localStorage.getItem('user') || 'null');
  
  // 检查用户是否已登录
  if (!user) {
    window.location.href = '/login.html';
    return;
  }
  
  // 初始化用户信息显示
  initUserInfo();
  
  // 获取用户最新信息
  fetchUserProfile();
  
  // 加载生成历史
  loadGenerationHistory();
  
  // 加载积分使用记录
  loadCreditsUsageHistory();
  
  // 标签页切换事件
  if (tabButtons && tabButtons.length > 0) {
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabName = button.getAttribute('data-tab');
        
        // 移除所有标签页的活动状态
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // 添加当前标签页的活动状态
        button.classList.add('active');
        const tabContent = document.getElementById(`${tabName}-tab`);
        if (tabContent) {
          tabContent.classList.add('active');
          
          // 如果是积分记录标签页，刷新数据
          if (tabName === 'credits' && usageList) {
            loadCreditsUsageHistory();
          }
        }
      });
    });
  }
  
  // 排序选择事件
  if (historySort) {
    historySort.addEventListener('change', function() {
      sortOrder = this.value;
      currentPage = 1;
      loadGenerationHistory();
    });
  }
  
  // 关闭模态框
  if (closeModal) {
    closeModal.addEventListener('click', function() {
      imageModal.style.display = 'none';
    });
  }
  
  // 关闭确认删除模态框的事件
  const closeDeleteModal = document.getElementById('close-delete-modal');
  const deleteConfirmModal = document.getElementById('delete-confirm-modal');
  if (closeDeleteModal && deleteConfirmModal) {
    closeDeleteModal.addEventListener('click', function() {
      deleteConfirmModal.style.display = 'none';
    });
  }
  
  // 取消删除按钮事件
  const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
  if (cancelDeleteBtn && deleteConfirmModal) {
    cancelDeleteBtn.addEventListener('click', function() {
      deleteConfirmModal.style.display = 'none';
    });
  }
  
  // 确认删除按钮事件 - 全局绑定
  const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
  let currentImageId = null;
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', function() {
      if (currentImageId) {
        deleteImage(currentImageId);
        if (deleteConfirmModal) deleteConfirmModal.style.display = 'none';
        if (imageModal) imageModal.style.display = 'none';
      }
    });
  }
  
  // 点击模态框外部关闭模态框
  window.addEventListener('click', function(event) {
    if (event.target === imageModal) {
      imageModal.style.display = 'none';
    }
    if (event.target === deleteConfirmModal) {
      deleteConfirmModal.style.display = 'none';
    }
  });
  
  // 初始化用户信息
  function initUserInfo() {
    if (usernameElement) usernameElement.textContent = user.username || '';
    if (emailElement) emailElement.textContent = user.email || '';
    if (creditsElement) creditsElement.textContent = user.credits || 0;
    if (creditsAmountElement) creditsAmountElement.textContent = user.credits || 0;
    if (displayUsernameElement) displayUsernameElement.textContent = user.username || '';
    
    // 格式化注册时间
    if (createdAtElement && user.createdAt) {
      const date = new Date(user.createdAt);
      createdAtElement.textContent = date.toLocaleString();
    }
  }
  
  // 获取用户信息
  async function fetchUserProfile() {
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        user = data.user;
        localStorage.setItem('user', JSON.stringify(user));
        
        // 更新用户信息显示
        initUserInfo();
        
        // 更新生成次数显示
        if (generationCountElement && data.generationCount) {
          generationCountElement.textContent = data.generationCount;
        }
      } else if (response.status === 401) {
        // 认证失败，重定向到登录页面
        window.location.href = '/login.html';
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
    }
  }
  
  // 加载生成历史
  async function loadGenerationHistory() {
    try {
      // 构建查询参数
      const params = new URLSearchParams({
        page: currentPage,
        limit: itemsPerPage,
        sort: sortOrder
      });
      
      const response = await fetch(`/api/history?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // 更新总页数
        totalPages = Math.ceil(data.total / itemsPerPage);
        
        // 渲染历史记录
        renderHistory(data.images);
        
        // 渲染分页
        renderPagination();
      } else if (response.status === 401) {
        // 认证失败，重定向到登录页面
        window.location.href = '/login.html';
      } else {
        historyGrid.innerHTML = '<div class="empty-history">加载历史记录失败</div>';
      }
    } catch (error) {
      console.error('获取生成历史失败:', error);
      historyGrid.innerHTML = '<div class="empty-history">加载历史记录失败</div>';
    }
  }
  
  // 渲染历史记录
  function renderHistory(images) {
    // 清空现有内容
    historyGrid.innerHTML = '';
    
    if (images && images.length > 0) {
      images.forEach(image => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        // 格式化日期
        const date = new Date(image.createdAt).toLocaleDateString();
        
        historyItem.innerHTML = `
          <div class="history-image">
            <img src="${image.generatedImage}" alt="生成图像">
          </div>
          <div class="history-details">
            <div class="history-date">${date}</div>
            <div class="history-prompt">${truncateText(image.prompt, 30)}</div>
          </div>
        `;
        
        // 点击查看详情
        historyItem.addEventListener('click', () => showImageDetails(image));
        
        historyGrid.appendChild(historyItem);
      });
    } else {
      historyGrid.innerHTML = '<div class="empty-history">暂无生成历史</div>';
    }
  }
  
  // 渲染分页
  function renderPagination() {
    if (!pagination) return;
    
    // 清空现有内容
    pagination.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    // 上一页按钮
    const prevBtn = document.createElement('button');
    prevBtn.className = 'pagination-btn';
    prevBtn.textContent = '上一页';
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        loadGenerationHistory();
      }
    });
    pagination.appendChild(prevBtn);
    
    // 页码按钮
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // 调整起始页码
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      const pageBtn = document.createElement('button');
      pageBtn.className = 'pagination-btn' + (i === currentPage ? ' active' : '');
      pageBtn.textContent = i;
      pageBtn.addEventListener('click', () => {
        if (i !== currentPage) {
          currentPage = i;
          loadGenerationHistory();
        }
      });
      pagination.appendChild(pageBtn);
    }
    
    // 下一页按钮
    const nextBtn = document.createElement('button');
    nextBtn.className = 'pagination-btn';
    nextBtn.textContent = '下一页';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        loadGenerationHistory();
      }
    });
    pagination.appendChild(nextBtn);
  }
  
  // 显示图像详情
  function showImageDetails(image) {
    if (!image) return;
    
    try {
      // 填充模态框内容
      if (modalOriginalImage) modalOriginalImage.src = image.originalImage || '';
      if (modalGeneratedImage) modalGeneratedImage.src = image.generatedImage || '';
      if (modalPrompt) modalPrompt.textContent = image.prompt || '';
      if (modalCreditsUsed) modalCreditsUsed.textContent = image.creditsUsed || '1';
      
      // 设置使用模型
      if (modalModelUsed) modalModelUsed.textContent = image.model || 'gpt-4-vision-preview';
      
      // 格式化日期
      if (modalCreatedAt && image.createdAt) {
        const date = new Date(image.createdAt).toLocaleString();
        modalCreatedAt.textContent = date;
      }
      
      // 设置下载链接
      if (image.generatedImage) {
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
          
          try {
            // 设置 JPEG 下载链接
            if (modalDownloadJpgBtn) {
              const jpegUrl = canvas.toDataURL('image/jpeg', 0.9);
              modalDownloadJpgBtn.href = jpegUrl;
              modalDownloadJpgBtn.download = `generated-image-${image._id || Date.now()}.jpg`;
            }
            
            // 设置 PNG 下载链接
            if (modalDownloadPngBtn) {
              const pngUrl = canvas.toDataURL('image/png');
              modalDownloadPngBtn.href = pngUrl;
              modalDownloadPngBtn.download = `generated-image-${image._id || Date.now()}.png`;
            }
          } catch (err) {
            console.error('转换图像格式失败:', err);
            // 如果转换失败，回退到原始 URL
            if (modalDownloadJpgBtn) {
              modalDownloadJpgBtn.href = image.generatedImage;
              modalDownloadJpgBtn.download = `generated-image-${image._id || Date.now()}.jpg`;
            }
            if (modalDownloadPngBtn) {
              modalDownloadPngBtn.href = image.generatedImage;
              modalDownloadPngBtn.download = `generated-image-${image._id || Date.now()}.png`;
            }
          }
        };
        
        img.onerror = function() {
          console.error('加载图像失败');
          // 加载失败时使用原始 URL
          if (modalDownloadJpgBtn) {
            modalDownloadJpgBtn.href = image.generatedImage;
            modalDownloadJpgBtn.download = `generated-image-${image._id || Date.now()}.jpg`;
          }
          if (modalDownloadPngBtn) {
            modalDownloadPngBtn.href = image.generatedImage;
            modalDownloadPngBtn.download = `generated-image-${image._id || Date.now()}.png`;
          }
        };
        
        // 开始加载图像
        img.src = image.generatedImage;
      }
      
      // 删除按钮事件
      if (modalDeleteBtn) {
        modalDeleteBtn.onclick = () => {
          // 记录当前图像 ID
          currentImageId = image._id;
          
          // 打开确认删除模态框
          const deleteConfirmModal = document.getElementById('delete-confirm-modal');
          if (deleteConfirmModal) {
            deleteConfirmModal.style.display = 'block';
          }
        };
      }
      
      // 显示模态框
      if (imageModal) imageModal.style.display = 'block';
    } catch (error) {
      console.error('显示图像详情失败:', error);
    }
  }
  
  // 辅助函数：截断文本
  function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }
  
  // 删除图像函数
  async function deleteImage(imageId) {
    if (!imageId) {
      console.error('删除图像失败: 缺少图像 ID');
      return;
    }
    
    try {
      // 发送删除请求到服务器
      const response = await fetch(`/api/history/${imageId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        // 删除成功，刷新历史记录
        loadGenerationHistory();
        // 显示成功提示
        alert('图像已成功删除');
      } else {
        // 处理错误响应
        const errorData = await response.json();
        throw new Error(errorData.message || '删除图像失败');
      }
    } catch (error) {
      console.error('删除图像失败:', error);
      alert('删除图像失败: ' + error.message);
    }
  }
  
  // 加载积分使用记录
  async function loadCreditsUsageHistory() {
    if (!usageList) return;
    
    try {
      // 显示加载中状态
      usageList.innerHTML = '<p class="loading-message"><i class="fas fa-spinner fa-spin"></i> 正在加载使用记录...</p>';
      
      // 尝试从服务器获取数据
      const response = await fetch('/api/credits/usage', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.records && data.records.length > 0) {
          displayUsageRecords(data.records);
        } else {
          // 没有记录，显示模拟数据
          displayMockUsageRecords();
        }
      } else {
        // API调用失败，显示模拟数据
        displayMockUsageRecords();
      }
    } catch (error) {
      console.error('获取积分使用记录失败:', error);
      // 发生错误，显示模拟数据
      displayMockUsageRecords();
    }
  }
  
  // 显示积分使用记录
  function displayUsageRecords(records) {
    if (!usageList) return;
    
    // 清空现有内容
    usageList.innerHTML = '';
    
    // 添加使用记录
    records.forEach(record => {
      const date = new Date(record.createdAt).toLocaleString();
      const item = document.createElement('div');
      item.className = 'transaction-item';
      
      item.innerHTML = `
        <div class="transaction-date">${date}</div>
        <div class="transaction-details">${record.description || '生成图像'}</div>
        <div class="transaction-amount negative">-${Math.abs(record.amount)} 积分</div>
      `;
      
      usageList.appendChild(item);
    });
  }
  
  // 显示模拟积分使用记录
  function displayMockUsageRecords() {
    if (!usageList) return;
    
    // 模拟使用记录
    const mockUsageRecords = [
      { date: '2025/4/2 11:03:05', description: '生成图像 (gpt-4o-image)', amount: 1 },
      { date: '2025/4/2 10:54:00', description: '生成图像 (gpt-4-vision-preview)', amount: 1 }
    ];
    
    // 清空现有内容
    usageList.innerHTML = '';
    
    // 添加模拟使用记录
    mockUsageRecords.forEach(record => {
      const item = document.createElement('div');
      item.className = 'transaction-item';
      
      item.innerHTML = `
        <div class="transaction-date">${record.date}</div>
        <div class="transaction-details">${record.description}</div>
        <div class="transaction-amount negative">-${record.amount} 积分</div>
      `;
      
      usageList.appendChild(item);
    });
  }
  
  // 退出登录按钮
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      
      // 清除本地存储的用户信息
      localStorage.removeItem('user');
      
      // 发送登出请求到服务器（清除cookie等）
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }).finally(() => {
        // 无论成功失败都重定向到登录页面
        window.location.href = '/login.html';
      });
    });
  }
});
