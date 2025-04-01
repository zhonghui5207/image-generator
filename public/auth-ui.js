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
      
      // 如果用户未登录，显示登录提示
      if (!isAuthenticated) {
        const authBanner = document.getElementById('auth-banner');
        if (authBanner) {
          authBanner.style.display = '';
          // 滚动到提示区域
          authBanner.scrollIntoView({ behavior: 'smooth' });
        }
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
