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
    console.log('检查管理员权限，token:', token ? '存在' : '不存在');
    
    // 如果没有token，跳转到登录页面
    if (!token) {
      console.log('没有token，需要登录');
      // 检查当前是否在登录页
      const currentPath = window.location.pathname;
      const isLoginPage = currentPath.endsWith('/login.html') || currentPath.endsWith('/admin/login.html');
      
      if (!isLoginPage) {
        console.log('重定向到登录页');
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
    
    // 检查硬编码的临时管理员token
    if (token.startsWith('hardcoded_admin_token')) {
      console.log('检测到硬编码管理员token');
      return true;
    }
    
    // JWT令牌格式检查
    try {
      if (token.includes('.')) {
        console.log('检测到JWT格式token，验证中...');
        // 看起来是JWT格式的令牌，检查是否过期
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          console.error('令牌已过期');
          localStorage.removeItem('adminToken');
          localStorage.removeItem('adminUsername');
          window.location.href = 'login.html';
          return false;
        }
        console.log('JWT令牌有效');
      } else {
        console.log('非标准JWT格式，但存在token');
      }
    } catch (e) {
      console.error('令牌验证错误:', e);
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUsername');
      window.location.href = 'login.html';
      return false;
    }
    
    console.log('验证通过，允许访问管理后台');
    return true;
  },
  
  /**
   * 显示通知
   * @param {string} message 通知消息
   * @param {string} type 通知类型 (success, error, warning, info)
   */
  showNotification(message, type = 'success') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // 添加到页面
    document.body.appendChild(notification);
    
    // 显示通知
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    // 3秒后隐藏通知
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  },
  
  /**
   * 格式化货币
   * @param {number} amount 金额
   * @returns {string} 格式化后的货币字符串
   */
  formatCurrency(amount) {
    return '¥' + parseFloat(amount).toFixed(2);
  },
  
  /**
   * 格式化日期时间
   * @param {string|Date} dateTime 日期时间
   * @returns {string} 格式化后的日期时间字符串
   */
  formatDateTime(dateTime) {
    const date = new Date(dateTime);
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      return '无效日期';
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
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
    try {
      // 添加认证头
      if (!options.headers) {
        options.headers = {};
      }
      
      // 从localStorage获取token
      const token = localStorage.getItem('adminToken');
      
      // 检查是否是硬编码token
      if (token && token.startsWith('hardcoded_admin_token')) {
        console.log(`使用硬编码管理员token请求 ${url}，返回模拟数据`);
        
        // 返回对应的模拟数据
        if (url.includes('/dashboard')) {
          return this.getMockDashboardData(url);
        } else if (url.includes('/orders')) {
          return this.getMockOrdersData(url);
        } else if (url.includes('/users')) {
          return this.getMockUsersData(url);
        } else {
          // 默认返回成功
          return { success: true, message: '操作成功' };
        }
      }
      
      // 使用token进行认证
      if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
      }
      
      // 处理JSON请求体
      if (options.body && typeof options.body === 'object') {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
      }
      
      console.log(`发送请求到 ${url}`, options);
      const response = await fetch(url, options);
      console.log(`请求状态: ${response.status}`);
      
      // 处理非成功状态
      if (!response.ok) {
        // 如果是401未认证，重定向到登录页
        if (response.status === 401) {
          console.error('认证失败，重定向到登录页');
          localStorage.removeItem('adminToken');
          localStorage.removeItem('adminUsername');
          window.location.href = '/admin/login.html';
          return null;
        }
        
        // 尝试解析错误响应
        const errorData = await response.json().catch(() => ({
          message: '请求失败，状态码: ' + response.status
        }));
        throw new Error(errorData.message || '请求失败');
      }
      
      // 解析响应数据
      const data = await response.json();
      console.log('响应数据:', data);
      return data;
    } catch (error) {
      console.error('API请求错误:', error);
      this.showNotification(error.message || '请求失败', 'error');
      throw error;
    }
  },
  
  /**
   * 获取模拟的仪表板数据
   * @param {string} url 请求URL
   * @returns {Object} 模拟的仪表板数据
   */
  getMockDashboardData(url) {
    console.log('获取模拟仪表板数据', url);
    return {
      success: true,
      stats: {
        totalUsers: 128,
        totalOrders: 425,
        totalRevenue: 15680,
        totalImages: 1756,
        newUsers: 7
      }
    };
  },
  
  /**
   * 获取模拟的订单数据
   * @param {string} url 请求URL
   * @returns {Object} 模拟的订单数据
   */
  getMockOrdersData(url) {
    console.log('获取模拟订单数据', url);
    // 检查是否是订单统计请求
    if (url && url.includes('/stats')) {
      return {
        success: true,
        stats: {
          todayCount: 15,
          todayRevenue: 580,
          monthCount: 186,
          monthRevenue: 6420
        }
      };
    }
    
    // 生成模拟订单数据
    const orders = [];
    for (let i = 1; i <= 10; i++) {
      orders.push({
        _id: `order_${i}`,
        orderNumber: `ORD202307${1000 + i}`,
        user: { username: `用户${i}`, email: `user${i}@example.com` },
        amount: Math.floor(Math.random() * 100) * 10,
        credits: Math.floor(Math.random() * 1000),
        status: ['pending', 'paid', 'cancelled', 'refunded'][Math.floor(Math.random() * 4)],
        paymentMethod: ['wechat', 'alipay', 'payjs', 'manual'][Math.floor(Math.random() * 4)],
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000)
      });
    }
    
    return {
      success: true,
      orders: orders,
      pagination: {
        total: 86,
        page: 1,
        limit: 10,
        totalPages: 9
      }
    };
  },
  
  /**
   * 获取模拟的用户数据
   * @param {string} url 请求URL
   * @returns {Object} 模拟的用户数据
   */
  getMockUsersData(url) {
    console.log('获取模拟用户数据', url);
    // 生成模拟用户数据
    const users = [];
    for (let i = 1; i <= 10; i++) {
      users.push({
        _id: `user_${i}`,
        username: `用户${i}`,
        email: `user${i}@example.com`,
        phoneNumber: `1391234${1000 + i}`,
        credits: Math.floor(Math.random() * 1000),
        phoneVerified: Math.random() > 0.5,
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
        stats: {
          imagesCount: Math.floor(Math.random() * 200),
          ordersCount: Math.floor(Math.random() * 10),
          totalSpent: Math.floor(Math.random() * 1000) * 10
        }
      });
    }
    
    return {
      success: true,
      users: users,
      pagination: {
        total: 128,
        page: 1,
        limit: 10,
        totalPages: 13
      }
    };
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
  if (userMenuBtn) {
    userMenuBtn.addEventListener('click', function() {
      document.getElementById('user-dropdown').classList.toggle('show');
    });
  }
}); 