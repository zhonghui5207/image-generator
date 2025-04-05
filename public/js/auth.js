// 获取当前用户信息
async function getCurrentUser() {
  try {
    const response = await fetch('/api/auth/me');
    const data = await response.json();
    
    if (data.success) {
      return data.user;
    } else {
      return null;
    }
  } catch (error) {
    console.error('获取用户信息出错:', error);
    return null;
  }
}

// 检查用户是否已登录
async function checkLogin() {
  const user = await getCurrentUser();
  return user !== null;
}

// 检查用户是否已绑定手机号
async function checkPhoneVerification() {
  const user = await getCurrentUser();
  
  if (!user) {
    // 未登录，重定向到登录页
    window.location.href = '/login.html';
    return false;
  }
  
  // 获取当前页面URL路径
  const currentPath = window.location.pathname;
  // 检查是否已经在绑定手机号页面，避免重定向循环
  const isBindPhonePage = currentPath.includes('bind-phone.html');
  
  if (!user.phoneVerified && !isBindPhonePage) {
    // 未绑定手机号且不在绑定页面，强制重定向到绑定页面
    window.location.href = '/bind-phone.html';
    return false;
  } else if (isBindPhonePage && user.phoneVerified) {
    // 已绑定手机号但仍在绑定页面，重定向到首页
    window.location.href = '/index.html';
    return true;
  }
  
  return user.phoneVerified; // 只有手机验证通过才返回true
}

// 用户登出
async function logout() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST'
    });
    
    // 重定向到登录页
    window.location.href = '/login.html';
  } catch (error) {
    console.error('登出出错:', error);
  }
}

// 导出函数
window.auth = {
  getCurrentUser,
  checkLogin,
  checkPhoneVerification,
  logout
}; 