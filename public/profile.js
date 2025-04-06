document.addEventListener('DOMContentLoaded', function() {
  // 获取DOM元素 - 用户信息
  const usernameElement = document.getElementById('username');
  const emailElement = document.getElementById('email');
  const phoneNumberElement = document.getElementById('phone-number');
  const phoneStatusElement = document.getElementById('phone-status');
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
    
    // 显示手机号信息
    if (phoneNumberElement && user.phoneNumber) {
      phoneNumberElement.textContent = maskPhoneNumber(user.phoneNumber) || '未绑定';
      if (phoneStatusElement && user.phoneVerified) {
        phoneStatusElement.style.display = 'inline-block';
      } else if (phoneStatusElement) {
        phoneStatusElement.style.display = 'none';
      }
    } else if (phoneNumberElement) {
      phoneNumberElement.textContent = '未绑定';
      if (phoneStatusElement) phoneStatusElement.style.display = 'none';
    }
    
    if (creditsElement) creditsElement.textContent = user.credits || 0;
    if (creditsAmountElement) creditsAmountElement.textContent = user.credits || 0;
    if (displayUsernameElement) displayUsernameElement.textContent = user.username || '';
    
    // 格式化注册时间
    if (createdAtElement && user.createdAt) {
      const date = new Date(user.createdAt);
      createdAtElement.textContent = date.toLocaleString();
    }
  }
  
  // 掩码显示手机号，只显示前3位和后4位
  function maskPhoneNumber(phoneNumber) {
    if (!phoneNumber) return '';
    
    // 移除可能的+86前缀
    let phone = phoneNumber.replace(/^\+86/, '');
    
    if (phone.length >= 7) {
      return phone.substring(0, 3) + '****' + phone.substring(phone.length - 4);
    } else {
      return phone;
    }
  }
  
  // 获取用户信息
  async function fetchUserProfile() {
    try {
      const response = await fetch('/api/auth/me', {
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
        
        // 获取生成次数信息
        const profileResponse = await fetch('/api/auth/profile', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          // 更新生成次数显示
          if (generationCountElement && profileData.generationCount) {
            generationCountElement.textContent = profileData.generationCount;
          }
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
        
        // 判断是否为文生图模式
        const isTextToImage = image.mode === 'text-to-image';
        
        // 格式化日期
        const date = new Date(image.createdAt).toLocaleDateString();
        
        // 根据模式添加不同的标识
        const modeLabel = isTextToImage ? 
          '<div class="mode-label text-mode"><i class="fas fa-font"></i> 文生图</div>' : 
          '<div class="mode-label image-mode"><i class="fas fa-image"></i> 图生图</div>';
        
        historyItem.innerHTML = `
          <div class="history-image">
            <img src="${image.generatedImage}" alt="生成图像">
            ${modeLabel}
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
      
      // 添加模式标签的样式
      const style = document.createElement('style');
      style.textContent = `
        .mode-label {
          position: absolute;
          top: 8px;
          right: 8px;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 12px;
          color: white;
          background-color: rgba(0, 0, 0, 0.6);
        }
        .text-mode {
          background-color: rgba(75, 0, 130, 0.7);
        }
        .image-mode {
          background-color: rgba(0, 100, 150, 0.7);
        }
        .history-image {
          position: relative;
        }
      `;
      document.head.appendChild(style);
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
      // 根据图像模式调整显示内容
      const isTextToImage = image.mode === 'text-to-image';
      
      // 获取原始图像容器和标题
      const originalImageContainer = document.querySelector('.original-image');
      
      // 根据模式显示或隐藏原始图像部分
      if (originalImageContainer) {
        originalImageContainer.style.display = isTextToImage ? 'none' : 'block';
      }
      
      // 调整生成图像的宽度
      const generatedImageContainer = document.querySelector('.generated-image');
      if (generatedImageContainer) {
        generatedImageContainer.style.width = isTextToImage ? '100%' : '50%';
      }
      
      // 填充模态框内容
      if (modalOriginalImage) modalOriginalImage.src = image.originalImage || '';
      if (modalGeneratedImage) modalGeneratedImage.src = image.generatedImage || '';
      if (modalPrompt) modalPrompt.textContent = image.prompt || '';
      if (modalCreditsUsed) modalCreditsUsed.textContent = image.creditsUsed || '1';
      
      // 设置使用模型
      // 根据模型值显示友好的模型名称
      if (modalModelUsed) {
        const modelName = getModelDisplayName(image.model || 'gpt-4o-image');
        modalModelUsed.textContent = modelName;
      }
      
      // 格式化日期
      if (modalCreatedAt && image.createdAt) {
        const date = new Date(image.createdAt).toLocaleString();
        modalCreatedAt.textContent = date;
      }
      
      // 设置下载链接
      if (image.generatedImage) {
        // 检测是否为移动设备
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
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
            // 针对移动设备，我们需要设置点击事件而非直接设置href
            if (isMobile) {
              // 设置JPG下载按钮点击事件
              if (modalDownloadJpgBtn) {
                modalDownloadJpgBtn.removeAttribute("download");
                modalDownloadJpgBtn.onclick = function(e) {
                  e.preventDefault();
                  const jpegBlob = canvas.toDataURL('image/jpeg', 0.9);
                  
                  // 为iOS设备创建临时视图
                  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
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
                    imgElement.src = jpegBlob;
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
                    };
                    
                    tempImg.appendChild(imgElement);
                    tempImg.appendChild(helpText);
                    tempImg.appendChild(closeBtn);
                    document.body.appendChild(tempImg);
                  } else {
                    // Android设备
                    const imageType = btn.textContent.includes('PNG') ? 'image/png' : 'image/jpeg';
                    canvas.toBlob(function(blob) {
                      try {
                        if (navigator.share) {
                          const fileName = `generated-image-${Date.now()}.${imageType === 'image/png' ? 'png' : 'jpg'}`;
                          const file = new File([blob], fileName, { type: imageType });
                          navigator.share({
                            files: [file],
                            title: '柯达鸭生成的图像',
                          }).catch(err => {
                            console.log('分享失败，尝试其他方式下载', err);
                            // 创建下载链接
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.style.display = 'none';
                            a.href = url;
                            a.download = fileName;
                            document.body.appendChild(a);
                            a.click();
                            
                            // 清理
                            setTimeout(function() {
                              document.body.removeChild(a);
                              window.URL.revokeObjectURL(url);
                            }, 100);
                          });
                        } else {
                          // 创建下载链接
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.style.display = 'none';
                          a.href = url;
                          a.download = `generated-image-${Date.now()}.${imageType === 'image/png' ? 'png' : 'jpg'}`;
                          document.body.appendChild(a);
                          a.click();
                          
                          // 清理
                          setTimeout(function() {
                            document.body.removeChild(a);
                            window.URL.revokeObjectURL(url);
                          }, 100);
                        }
                      } catch (err) {
                        console.error('Android设备下载失败:', err);
                        window.open(canvas.toDataURL(imageType), '_blank');
                      }
                    }, imageType, 0.9);
                  }
                };
              }
              
              // 设置PNG下载按钮点击事件
              if (modalDownloadPngBtn) {
                modalDownloadPngBtn.removeAttribute("download");
                modalDownloadPngBtn.onclick = function(e) {
                  e.preventDefault();
                  const pngBlob = canvas.toDataURL('image/png');
                  
                  // 为iOS设备创建临时视图
                  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
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
                    imgElement.src = pngBlob;
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
                    };
                    
                    tempImg.appendChild(imgElement);
                    tempImg.appendChild(helpText);
                    tempImg.appendChild(closeBtn);
                    document.body.appendChild(tempImg);
                  } else {
                    // Android设备
                    const imageType = btn.textContent.includes('PNG') ? 'image/png' : 'image/jpeg';
                    canvas.toBlob(function(blob) {
                      try {
                        if (navigator.share) {
                          const fileName = `generated-image-${Date.now()}.${imageType === 'image/png' ? 'png' : 'jpg'}`;
                          const file = new File([blob], fileName, { type: imageType });
                          navigator.share({
                            files: [file],
                            title: '柯达鸭生成的图像',
                          }).catch(err => {
                            console.log('分享失败，尝试其他方式下载', err);
                            // 创建下载链接
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.style.display = 'none';
                            a.href = url;
                            a.download = fileName;
                            document.body.appendChild(a);
                            a.click();
                            
                            // 清理
                            setTimeout(function() {
                              document.body.removeChild(a);
                              window.URL.revokeObjectURL(url);
                            }, 100);
                          });
                        } else {
                          // 创建下载链接
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.style.display = 'none';
                          a.href = url;
                          a.download = `generated-image-${Date.now()}.${imageType === 'image/png' ? 'png' : 'jpg'}`;
                          document.body.appendChild(a);
                          a.click();
                          
                          // 清理
                          setTimeout(function() {
                            document.body.removeChild(a);
                            window.URL.revokeObjectURL(url);
                          }, 100);
                        }
                      } catch (err) {
                        console.error('Android设备下载失败:', err);
                        window.open(canvas.toDataURL(imageType), '_blank');
                      }
                    }, imageType, 0.9);
                  }
                };
              }
            } else {
              // 桌面设备常规方式
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
            }
          } catch (err) {
            console.error('转换图像格式失败:', err);
            // 如果转换失败，回退到原始 URL
            if (isMobile) {
              // 移动设备处理
              if (modalDownloadJpgBtn) {
                modalDownloadJpgBtn.removeAttribute("download");
                modalDownloadJpgBtn.onclick = function(e) {
                  e.preventDefault();
                  window.open(image.generatedImage, '_blank');
                };
              }
              if (modalDownloadPngBtn) {
                modalDownloadPngBtn.removeAttribute("download");
                modalDownloadPngBtn.onclick = function(e) {
                  e.preventDefault();
                  window.open(image.generatedImage, '_blank');
                };
              }
            } else {
              // 桌面设备处理
              if (modalDownloadJpgBtn) {
                modalDownloadJpgBtn.href = image.generatedImage;
                modalDownloadJpgBtn.download = `generated-image-${image._id || Date.now()}.jpg`;
              }
              if (modalDownloadPngBtn) {
                modalDownloadPngBtn.href = image.generatedImage;
                modalDownloadPngBtn.download = `generated-image-${image._id || Date.now()}.png`;
              }
            }
          }
        };
        
        img.onerror = function() {
          console.error('加载图像失败');
          // 加载失败时使用原始 URL
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          
          if (isMobile) {
            // 移动设备处理
            if (modalDownloadJpgBtn) {
              modalDownloadJpgBtn.removeAttribute("download");
              modalDownloadJpgBtn.onclick = function(e) {
                e.preventDefault();
                window.open(image.generatedImage, '_blank');
              };
            }
            if (modalDownloadPngBtn) {
              modalDownloadPngBtn.removeAttribute("download");
              modalDownloadPngBtn.onclick = function(e) {
                e.preventDefault();
                window.open(image.generatedImage, '_blank');
              };
            }
          } else {
            // 桌面设备处理
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
      
      // 尝试从服务器获取数据 - 确保获取的是使用记录而非购买记录
      const response = await fetch('/api/credits/usage-history', {
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
          // 没有记录，显示空状态
          usageList.innerHTML = '<p class="empty-list">暂无使用记录</p>';
        }
      } else {
        // API调用失败，显示错误状态
        usageList.innerHTML = '<p class="empty-list">无法加载使用记录</p>';
      }
    } catch (error) {
      console.error('获取积分使用记录失败:', error);
      // 发生错误，显示错误状态
      usageList.innerHTML = '<p class="empty-list">加载使用记录时出错</p>';
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
      
      // 提取模型名称和实际消耗的积分
      let creditsUsed = Math.abs(record.amount);
      
      item.innerHTML = `
        <div class="transaction-date">${date}</div>
        <div class="transaction-details">${record.description || '生成图像'}</div>
        <div class="transaction-amount negative">-${creditsUsed} 积分</div>
      `;
      
      usageList.appendChild(item);
    });
  }
  
  // 获取模型的友好显示名称
  function getModelDisplayName(modelValue) {
    switch (modelValue) {
      case 'gpt-4o-image':
        return '标准模式';
      case 'gpt-4o-all':
        return '高级模式';
      case 'gpt-4o-image-vip':
        return '专业模式';
      case 'gpt-4-vision-preview':
        return '旧版模式';
      default:
        return modelValue; // 如果没有匹配到，返回原始值
    }
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
  
  // 添加全局变量，处理历史图片的直接下载
  const bindAllDownloadButtons = function() {
    // 查找所有下载按钮（包括历史列表中的）
    const allDownloadBtns = document.querySelectorAll('a[download], .download-btn');
    
    // 检测是否为移动设备
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      allDownloadBtns.forEach(btn => {
        const originalHref = btn.getAttribute('href');
        // 跳过已处理的按钮
        if (btn.getAttribute('data-mobile-handled')) return;
        
        btn.setAttribute('data-mobile-handled', 'true');
        btn.removeAttribute('download');
        
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          
          // 如果是OSS链接，使用特殊处理
          if (originalHref && originalHref.includes('oss-cn-beijing.aliyuncs.com')) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = function() {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              
              try {
                // 为iOS设备创建临时视图
                if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                  const imageData = canvas.toDataURL('image/jpeg', 0.9);
                  
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
                  imgElement.src = imageData;
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
                  };
                  
                  tempImg.appendChild(imgElement);
                  tempImg.appendChild(helpText);
                  tempImg.appendChild(closeBtn);
                  document.body.appendChild(tempImg);
                } else {
                  // Android设备
                  const imageType = btn.textContent.includes('PNG') ? 'image/png' : 'image/jpeg';
                  canvas.toBlob(function(blob) {
                    try {
                      if (navigator.share) {
                        const fileName = `generated-image-${Date.now()}.${imageType === 'image/png' ? 'png' : 'jpg'}`;
                        const file = new File([blob], fileName, { type: imageType });
                        navigator.share({
                          files: [file],
                          title: '柯达鸭生成的图像',
                        }).catch(err => {
                          console.log('分享失败，尝试其他方式下载', err);
                          // 创建下载链接
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.style.display = 'none';
                          a.href = url;
                          a.download = fileName;
                          document.body.appendChild(a);
                          a.click();
                          
                          // 清理
                          setTimeout(function() {
                            document.body.removeChild(a);
                            window.URL.revokeObjectURL(url);
                          }, 100);
                        });
                      } else {
                        // 创建下载链接
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.style.display = 'none';
                        a.href = url;
                        a.download = `generated-image-${Date.now()}.${imageType === 'image/png' ? 'png' : 'jpg'}`;
                        document.body.appendChild(a);
                        a.click();
                        
                        // 清理
                        setTimeout(function() {
                          document.body.removeChild(a);
                          window.URL.revokeObjectURL(url);
                        }, 100);
                      }
                    } catch (err) {
                      console.error('Android设备下载失败:', err);
                      window.open(canvas.toDataURL(imageType), '_blank');
                    }
                  }, imageType, 0.9);
                }
              } catch (err) {
                console.error('处理图片失败，尝试直接打开:', err);
                window.open(originalHref, '_blank');
              }
            };
            
            img.onerror = function() {
              console.error('加载图片失败，尝试直接打开');
              window.open(originalHref, '_blank');
            };
            
            img.src = originalHref;
          } else if (originalHref) {
            // 非OSS链接
            window.open(originalHref, '_blank');
          }
        });
      });
    }
  };
  
  // 覆盖原始的showImageDetails函数，确保每次打开模态框时绑定下载按钮事件
  const originalShowImageDetails = window.showImageDetails || function() {};
  window.showImageDetails = function(image) {
    originalShowImageDetails(image);
    // 确保在模态框打开后，立即绑定下载按钮
    setTimeout(bindAllDownloadButtons, 100);
  };
  
  // 添加到原始的loadGenerationHistory
  const originalLoadGenerationHistory = window.loadGenerationHistory || function() {};
  window.loadGenerationHistory = function() {
    const result = originalLoadGenerationHistory.apply(this, arguments);
    // 历史加载后绑定下载按钮
    setTimeout(bindAllDownloadButtons, 500);
    return result;
  };
  
  // 初始绑定所有下载按钮
  bindAllDownloadButtons();
  
  // 添加MutationObserver监听DOM变化
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.addedNodes.length) {
        // 如果添加了新节点，检查是否需要绑定下载按钮
        bindAllDownloadButtons();
      }
    });
  });
  
  // 监听整个文档的变化
  observer.observe(document.body, { childList: true, subtree: true });
});
