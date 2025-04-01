document.addEventListener('DOMContentLoaded', function() {
  // 获取DOM元素
  const usernameElement = document.getElementById('username');
  const emailElement = document.getElementById('email');
  const creditsElement = document.getElementById('credits');
  const createdAtElement = document.getElementById('created-at');
  const creditsAmountElement = document.getElementById('credits-amount');
  const historyGrid = document.getElementById('history-grid');
  const historySort = document.getElementById('history-sort');
  const pagination = document.getElementById('pagination');
  const imageModal = document.getElementById('image-modal');
  const closeModal = document.querySelector('.close-modal');
  
  // 模态框元素
  const modalOriginalImage = document.getElementById('modal-original-image');
  const modalGeneratedImage = document.getElementById('modal-generated-image');
  const modalPrompt = document.getElementById('modal-prompt');
  const modalCreatedAt = document.getElementById('modal-created-at');
  const modalCreditsUsed = document.getElementById('modal-credits-used');
  const modalDownloadBtn = document.getElementById('modal-download-btn');
  const modalRegenerateBtn = document.getElementById('modal-regenerate-btn');
  
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
  
  // 点击模态框外部关闭
  window.addEventListener('click', function(event) {
    if (event.target == imageModal) {
      imageModal.style.display = 'none';
    }
  });
  
  // 初始化用户信息
  function initUserInfo() {
    if (usernameElement) usernameElement.textContent = user.username || '';
    if (emailElement) emailElement.textContent = user.email || '';
    if (creditsElement) creditsElement.textContent = user.credits || 0;
    if (creditsAmountElement) creditsAmountElement.textContent = user.credits || 0;
    
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
    // 填充模态框内容
    modalOriginalImage.src = image.originalImage;
    modalGeneratedImage.src = image.generatedImage;
    modalPrompt.textContent = image.prompt;
    modalCreditsUsed.textContent = image.creditsUsed;
    
    // 格式化日期
    const date = new Date(image.createdAt).toLocaleString();
    modalCreatedAt.textContent = date;
    
    // 设置下载链接
    modalDownloadBtn.href = image.generatedImage;
    modalDownloadBtn.download = `generated-image-${image._id}.jpg`;
    
    // 重新生成按钮事件
    modalRegenerateBtn.onclick = () => {
      // 关闭模态框
      imageModal.style.display = 'none';
      
      // 重定向到首页并填充提示词
      sessionStorage.setItem('regeneratePrompt', image.prompt);
      sessionStorage.setItem('regenerateImage', image.originalImage);
      window.location.href = '/';
    };
    
    // 显示模态框
    imageModal.style.display = 'block';
  }
  
  // 辅助函数：截断文本
  function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
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
