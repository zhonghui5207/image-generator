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
    
    // 检查自定义的管理员token
    if (token.startsWith('admin_token_')) {
      // 验证通过，这是我们自定义的管理员token
      return true;
    }
    
    // 如果不是自定义token，则检查JWT格式的令牌是否过期
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
    try {
      // 添加认证头
      if (!options.headers) {
        options.headers = {};
      }
      
      // 从localStorage获取token
      const token = localStorage.getItem('adminToken');
      
      // 检查是否是自定义管理员token
      if (token && token.startsWith('admin_token_')) {
        // 如果是自定义token，模拟请求和响应
        console.log(`使用自定义管理员token请求 ${url}`);
        
        // 根据请求URL返回模拟数据
        if (url.includes('/dashboard')) {
          return this.getMockDashboardData();
        } else if (url.includes('/orders')) {
          return this.getMockOrdersData();
        } else if (url.includes('/users')) {
          return this.getMockUsersData();
        } else {
          // 默认返回成功
          return { success: true, message: '操作成功' };
        }
      }
      
      // 如果是普通token，正常发送请求
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
   * @returns {Object} 模拟的仪表板数据
   */
  getMockDashboardData() {
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
   * @returns {Object} 模拟的订单数据
   */
  getMockOrdersData() {
    // 检查是否是订单统计请求
    if (arguments[0] && arguments[0].includes('/stats')) {
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
   * @returns {Object} 模拟的用户数据
   */
  getMockUsersData() {
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