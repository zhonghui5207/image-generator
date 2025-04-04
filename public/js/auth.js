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
  
  if (!user.phoneVerified) {
    // 未绑定手机号，重定向到绑定页面
    window.location.href = '/bind-phone.html';
    return false;
  }
  
  return true;
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