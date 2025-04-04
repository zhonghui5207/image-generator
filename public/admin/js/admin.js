/**
 * 管理后台公共工具函数
 */
const adminUtils = {
  /**
   * 检查管理员登录状态
   * @returns {boolean} 是否已登录
   */
  checkAdminAuth() {
    const token = localStorage.getItem('adminToken');
    
    // 如果没有token，跳转到登录页面
    if (!token) {
      if (window.location.pathname.indexOf('/admin/login.html') === -1) {
        window.location.href = 'login.html';
        return false;
      }
      return false;
    }
    
    // 更新显示的用户名
    const adminUsername = localStorage.getItem('adminUsername') || '管理员';
    const usernameElement = document.getElementById('admin-username');
    if (usernameElement) {
      usernameElement.textContent = adminUsername;
    }
    
    // 检查令牌是否过期（JWT的payload部分是Base64编码的JSON）
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUsername');
        window.location.href = '/admin/login.html';
        return false;
      }
    } catch (e) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUsername');
      window.location.href = '/admin/login.html';
      return false;
    }
    
    return true;
  },
  
  /**
   * 显示通知消息
   * @param {string} message 消息内容
   * @param {string} type 消息类型: success, error, info, warning
   */
  showNotification(message, type = 'success', duration = 3000) {
    // 移除现有的通知
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => {
      document.body.removeChild(notification);
    });
    
    // 创建新通知
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // 显示通知
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    // 自动关闭通知
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, duration);
  },
  
  /**
   * 格式化日期时间
   * @param {string|Date} dateStr 日期字符串或Date对象
   * @returns {string} 格式化后的日期字符串
   */
  formatDateTime(dateStr) {
    if (!dateStr) return '无';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  },
  
  /**
   * 格式化日期
   * @param {string|Date} dateStr 日期字符串或Date对象
   * @returns {string} 格式化后的日期字符串
   */
  formatDate(dateStr) {
    if (!dateStr) return '无';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  },
  
  /**
   * 格式化货币
   * @param {number} amount 金额（分）
   * @returns {string} 格式化后的金额字符串（元）
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY'
    }).format(amount);
  },
  
  /**
   * 转义HTML特殊字符，防止XSS攻击
   * @param {string} text 需要转义的文本
   * @returns {string} 转义后的文本
   */
  escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },
  
  /**
   * 截断文本
   * @param {string} text 需要截断的文本
   * @param {number} maxLength 最大长度
   * @returns {string} 截断后的文本
   */
  truncateText(text, maxLength = 100) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  },
  
  /**
   * 生成随机ID
   * @returns {string} 随机ID
   */
  generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  },
  
  /**
   * 将查询参数对象转换为URL查询字符串
   * @param {Object} params 查询参数对象
   * @returns {string} URL查询字符串
   */
  buildQueryString(params) {
    return Object.keys(params)
      .filter(key => params[key] !== undefined && params[key] !== null && params[key] !== '')
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');
  },
  
  /**
   * 从URL中获取查询参数
   * @param {string} name 参数名
   * @returns {string|null} 参数值
   */
  getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  },
  
  /**
   * 发送API请求
   * @param {string} url 请求URL
   * @param {Object} options fetch选项
   * @returns {Promise<any>} 响应数据
   */
  async apiRequest(url, options = {}) {
    // 添加认证头
    if (!options.headers) {
      options.headers = {};
    }
    options.headers['Authorization'] = `Bearer ${localStorage.getItem('adminToken')}`;
    
    if (options.body && typeof options.body === 'object') {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      // 如果是401未认证，重定向到登录页
      if (response.status === 401) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUsername');
        window.location.href = '/admin/login.html';
        return;
      }
      
      const errorData = await response.json().catch(() => ({
        message: '请求失败'
      }));
      throw new Error(errorData.message || '请求失败');
    }
    
    return response.json();
  }
};

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeOut {
    from { opacity: 1; transform: translateY(0); }
    to { opacity: 0; transform: translateY(-10px); }
  }
`;
document.head.appendChild(style);

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
  // 侧边栏切换
  const toggleSidebarBtn = document.querySelector('.toggle-sidebar');
  if (toggleSidebarBtn) {
    toggleSidebarBtn.addEventListener('click', function() {
      // 支持两种侧边栏结构
      const sidebar = document.querySelector('.sidebar') || document.querySelector('aside.sidebar');
      if (sidebar) {
        sidebar.classList.toggle('active');
      }
    });
  }
  
  // 用户下拉菜单
  const userMenuBtn = document.querySelector('.user-menu-btn');
document.head.appendChild(style); 