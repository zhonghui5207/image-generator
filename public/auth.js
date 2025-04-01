document.addEventListener('DOMContentLoaded', function() {
  // 获取表单元素
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  
  // 登录表单提交处理
  if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const errorElement = document.getElementById('login-error');
      
      // 隐藏之前的错误信息
      errorElement.style.display = 'none';
      
      try {
        // 发送登录请求
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          // 登录成功，重定向到首页
          localStorage.setItem('user', JSON.stringify(data.user));
          window.location.href = '/';
        } else {
          // 显示错误信息
          errorElement.textContent = data.message || '登录失败，请检查您的邮箱和密码';
          errorElement.style.display = 'block';
        }
      } catch (error) {
        console.error('登录错误:', error);
        errorElement.textContent = '登录请求失败，请稍后再试';
        errorElement.style.display = 'block';
      }
    });
  }
  
  // 注册表单提交处理
  if (registerForm) {
    registerForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const username = document.getElementById('username').value;
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirm-password').value;
      const errorElement = document.getElementById('register-error');
      
      // 隐藏之前的错误信息
      errorElement.style.display = 'none';
      
      // 验证密码匹配
      if (password !== confirmPassword) {
        errorElement.textContent = '两次输入的密码不匹配';
        errorElement.style.display = 'block';
        return;
      }
      
      try {
        // 发送注册请求
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          // 注册成功，重定向到首页
          localStorage.setItem('user', JSON.stringify(data.user));
          window.location.href = '/';
        } else {
          // 显示错误信息
          errorElement.textContent = data.message || '注册失败，请稍后再试';
          errorElement.style.display = 'block';
        }
      } catch (error) {
        console.error('注册错误:', error);
        errorElement.textContent = '注册请求失败，请稍后再试';
        errorElement.style.display = 'block';
      }
    });
  }
  
  // 检查用户是否已登录
  function checkAuth() {
    const user = localStorage.getItem('user');
    
    // 如果已登录并且当前页面是登录或注册页面，则重定向到首页
    if (user && (window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html'))) {
      window.location.href = '/';
    }
  }
  
  // 页面加载时检查认证状态
  checkAuth();
});
