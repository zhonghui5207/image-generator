// 获取用户token
function getToken() {
  // 从cookie中获取token
  const cookies = document.cookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim();
    if (cookie.startsWith('token=')) {
      return cookie.substring(6);
    }
  }
  return '';
}

// 导出工具函数
window.getToken = getToken; 