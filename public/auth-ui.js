document.addEventListener('DOMContentLoaded', function() {
  // 获取用户信息
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const isAuthenticated = !!user;
  
  console.log('用户登录状态:', isAuthenticated);
  if (isAuthenticated) {
    console.log('用户信息:', user);
  }
  
  // 获取需要根据认证状态显示的元素
  const authRequiredElements = document.querySelectorAll('.auth-required');
  const authNotRequiredElements = document.querySelectorAll('.auth-not-required');
  
  console.log('需要认证的元素数量:', authRequiredElements.length);
  console.log('不需要认证的元素数量:', authNotRequiredElements.length);
  
  // 根据认证状态显示/隐藏元素
  if (isAuthenticated) {
    // 显示需要认证的元素，隐藏不需要认证的元素
    authRequiredElements.forEach(el => {
      el.style.display = '';
      console.log('显示元素:', el.id || el.className);
    });
    
    authNotRequiredElements.forEach(el => {
      el.style.display = 'none';
      console.log('隐藏元素:', el.id || el.className);
    });
    
    // 如果有积分显示区域，更新积分数量
    const creditsAmount = document.getElementById('credits-amount');
    if (creditsAmount && user.credits !== undefined) {
      creditsAmount.textContent = user.credits;
      console.log('更新积分显示:', user.credits);
    }
    
    // 检查是否需要刷新用户信息（积分等）
    fetchUserProfile();
    
    // 检查用户是否已绑定手机号，如果未绑定则禁用图像生成功能
    if (user && !user.phoneVerified) {
      const generateBtn = document.getElementById('generate-btn');
      const uploadForm = document.getElementById('upload-form');
      const formElements = uploadForm ? uploadForm.querySelectorAll('input, button, textarea, select') : [];
      
      // 禁用生成按钮
      if (generateBtn) {
        generateBtn.disabled = true;
        generateBtn.title = '请先绑定手机号后再使用';
        generateBtn.classList.remove('active');
      }
      
      // 禁用表单所有输入元素
      formElements.forEach(el => {
        if (el.id !== 'generate-btn') {  // 避免重复禁用生成按钮
          el.disabled = true;
          el.title = '请先绑定手机号后再使用';
        }
      });
      
      // 添加手机绑定提示信息
      const container = document.querySelector('.upload-container');
      if (container) {
        // 检查是否已经存在提示信息，避免重复添加
        if (!document.getElementById('phone-verification-notice')) {
          const notice = document.createElement('div');
          notice.id = 'phone-verification-notice';
          notice.className = 'phone-verification-notice';
          notice.innerHTML = `
            <div class="alert-icon"><i class="fas fa-exclamation-triangle"></i></div>
            <div class="alert-content">
              <h3>需要绑定手机号</h3>
              <p>为防止滥用及提供更好的服务，使用图像生成功能前请先绑定手机号。</p>
              <a href="/bind-phone.html" class="bind-phone-btn">立即绑定手机号</a>
            </div>
          `;
          container.prepend(notice);
          
          // 添加样式
          const style = document.createElement('style');
          style.textContent = `
            .phone-verification-notice {
              background-color: #fff3cd;
              color: #856404;
              padding: 15px;
              margin-bottom: 20px;
              border-radius: 8px;
              border-left: 5px solid #ffc107;
              display: flex;
              align-items: center;
              box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            .alert-icon {
              font-size: 2rem;
              margin-right: 15px;
              color: #ffc107;
            }
            .alert-content h3 {
              margin: 0 0 10px 0;
              font-size: 1.2rem;
            }
            .alert-content p {
              margin: 0 0 15px 0;
            }
            .bind-phone-btn {
              background-color: #4a6bdf;
              color: white;
              padding: 8px 15px;
              border-radius: 4px;
              text-decoration: none;
              display: inline-block;
              transition: background-color 0.3s;
            }
            .bind-phone-btn:hover {
              background-color: #3a5bcf;
              transform: translateY(-2px);
            }
          `;
          document.head.appendChild(style);
        }
      }
    }
  } else {
    // 隐藏需要认证的元素，显示不需要认证的元素
    authRequiredElements.forEach(el => {
      el.style.display = 'none';
      console.log('隐藏元素:', el.id || el.className);
    });
    
    authNotRequiredElements.forEach(el => {
      el.style.display = '';
      console.log('显示元素:', el.id || el.className);
    });
    
    // 显示未登录提示横幅
    const authBanner = document.getElementById('auth-banner');
    if (authBanner) {
      authBanner.style.display = '';
      console.log('显示未登录提示横幅');
    }
  }
  
  // 退出登录按钮事件处理
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      logout();
    });
  }
  
  // 从服务器获取最新的用户信息
  async function fetchUserProfile() {
    if (!isAuthenticated) return;
    
    try {
      console.log('正在获取用户信息...');
      const response = await fetch('/api/auth/profile', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('获取到的用户信息:', data);
        
        // 更新本地存储的用户信息
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // 更新页面上的积分显示
        const creditsAmount = document.getElementById('credits-amount');
        if (creditsAmount && data.user.credits !== undefined) {
          creditsAmount.textContent = data.user.credits;
          console.log('更新积分显示:', data.user.credits);
        }
        
        // 更新用户名显示（如果有的话）
        const usernameElement = document.getElementById('username-display');
        if (usernameElement && data.user.username) {
          usernameElement.textContent = data.user.username;
          usernameElement.style.display = '';
        }
        
        // 如果用户未绑定手机号，刷新页面以应用限制
        if (!data.user.phoneVerified && window.location.pathname === '/') {
          window.location.href = '/bind-phone.html';
        }
      } else if (response.status === 401) {
        console.log('认证失败，执行登出操作');
        // 如果认证失败（token过期等），执行登出操作
        logout();
      } else {
        console.error('获取用户信息失败:', response.status, await response.text());
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
    }
  }
  
  // 退出登录函数
  function logout() {
    console.log('执行退出登录操作');
    
    // 清除本地存储的用户信息
    localStorage.removeItem('user');
    
    // 发送登出请求到服务器（清除cookie等）
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(response => {
      console.log('退出登录响应:', response.status);
      return response.text();
    })
    .then(text => {
      console.log('退出登录响应内容:', text);
    })
    .catch(error => {
      console.error('退出登录错误:', error);
    })
    .finally(() => {
      // 无论成功失败都重定向到登录页面
      console.log('重定向到登录页面');
      window.location.href = '/login.html';
    });
  }
  
  // 修改图像生成表单提交逻辑，检查用户是否登录以及是否有足够积分
  const uploadForm = document.getElementById('upload-form');
  if (uploadForm) {
    const originalSubmitEvent = uploadForm.onsubmit;
    
    uploadForm.onsubmit = async function(e) {
      e.preventDefault();
      
      // 如果用户未登录，显示登录提示并引导去登录
      if (!isAuthenticated) {
        const authBanner = document.getElementById('auth-banner');
        if (authBanner) {
          authBanner.style.display = '';
          // 滚动到提示区域
          authBanner.scrollIntoView({ behavior: 'smooth' });
          
          // 添加轻微延迟后跳转登录页面
          setTimeout(() => {
            window.location.href = '/login.html?redirect=index';
          }, 1000);
        } else {
          // 如果提示区域不存在，直接跳转
          window.location.href = '/login.html?redirect=index';
        }
        return;
      }
      
      // 检查用户是否已绑定手机号
      if (user && !user.phoneVerified) {
        alert('请先绑定手机号后再使用图像生成功能');
        window.location.href = '/bind-phone.html';
        return;
      }
      
      // 检查用户是否有足够积分
      if (user.credits < 1) {
        alert('您的积分不足，请购买积分后再生成图像。');
        window.location.href = '/credits.html';
        return;
      }
      
      // 执行原来的提交逻辑
      if (typeof originalSubmitEvent === 'function') {
        originalSubmitEvent.call(this, e);
      }
    };
  }
});
