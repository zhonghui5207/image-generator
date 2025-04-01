document.addEventListener('DOMContentLoaded', function() {
  // 获取DOM元素
  const creditPackages = document.querySelectorAll('.credit-package');
  const buyCreditsBtn = document.getElementById('buy-credits-btn');
  const creditsAmount = document.getElementById('credits-amount');
  const transactionList = document.getElementById('transaction-list');
  const paymentModal = document.getElementById('payment-modal');
  const packageDetails = document.getElementById('package-details');
  const confirmPaymentBtn = document.getElementById('confirm-payment-btn');
  const closeModal = document.querySelector('.close-modal');
  
  // 用户信息
  let user = JSON.parse(localStorage.getItem('user') || 'null');
  let selectedPackage = null;
  
  // 检查用户是否已登录
  if (!user) {
    window.location.href = '/login.html';
    return;
  }
  
  // 初始化积分显示
  if (creditsAmount) {
    creditsAmount.textContent = user.credits || 0;
  }
  
  // 获取用户最新信息
  fetchUserProfile();
  
  // 获取交易历史
  fetchTransactionHistory();
  
  // 选择套餐事件
  creditPackages.forEach(pkg => {
    pkg.addEventListener('click', function() {
      // 移除其他套餐的选中状态
      creditPackages.forEach(p => p.classList.remove('selected'));
      
      // 添加当前套餐的选中状态
      this.classList.add('selected');
      
      // 保存选中的套餐信息
      selectedPackage = {
        id: this.getAttribute('data-package'),
        name: this.querySelector('h3').textContent,
        credits: parseInt(this.querySelector('.package-credits').textContent),
        price: this.querySelector('.package-price').textContent
      };
      
      // 更新购买按钮文本
      buyCreditsBtn.textContent = `购买 ${selectedPackage.credits} 积分`;
      buyCreditsBtn.disabled = false;
    });
  });
  
  // 购买按钮点击事件
  if (buyCreditsBtn) {
    buyCreditsBtn.addEventListener('click', function() {
      if (!selectedPackage) {
        alert('请先选择一个积分套餐');
        return;
      }
      
      // 显示支付模态框
      packageDetails.innerHTML = `
        <div class="package-summary">
          <h3>${selectedPackage.name}</h3>
          <p class="package-credits">${selectedPackage.credits} 积分</p>
          <p class="package-price">${selectedPackage.price}</p>
        </div>
      `;
      
      paymentModal.style.display = 'block';
    });
  }
  
  // 关闭模态框
  if (closeModal) {
    closeModal.addEventListener('click', function() {
      paymentModal.style.display = 'none';
    });
  }
  
  // 点击模态框外部关闭
  window.addEventListener('click', function(event) {
    if (event.target == paymentModal) {
      paymentModal.style.display = 'none';
    }
  });
  
  // 确认支付按钮
  if (confirmPaymentBtn) {
    confirmPaymentBtn.addEventListener('click', async function() {
      if (!selectedPackage) return;
      
      const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;
      
      try {
        // 发送购买请求
        const response = await fetch('/api/credits/purchase', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            packageId: selectedPackage.id,
            amount: selectedPackage.credits,
            paymentMethod: paymentMethod
          })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          // 更新用户积分
          user.credits = data.newBalance;
          localStorage.setItem('user', JSON.stringify(user));
          
          // 更新页面显示
          creditsAmount.textContent = data.newBalance;
          
          // 关闭模态框
          paymentModal.style.display = 'none';
          
          // 显示成功消息
          alert(`购买成功！您已获得 ${selectedPackage.credits} 积分，当前积分余额: ${data.newBalance}`);
          
          // 刷新交易历史
          fetchTransactionHistory();
        } else {
          alert(`购买失败: ${data.message || '请稍后再试'}`);
        }
      } catch (error) {
        console.error('购买积分错误:', error);
        alert('购买请求失败，请稍后再试');
      }
    });
  }
  
  // 获取用户信息
  async function fetchUserProfile() {
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        user = data.user;
        localStorage.setItem('user', JSON.stringify(user));
        
        // 更新积分显示
        if (creditsAmount) {
          creditsAmount.textContent = user.credits || 0;
        }
      } else if (response.status === 401) {
        // 认证失败，重定向到登录页面
        window.location.href = '/login.html';
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
    }
  }
  
  // 获取交易历史
  async function fetchTransactionHistory() {
    try {
      const response = await fetch('/api/credits/transactions', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.transactions && data.transactions.length > 0) {
          // 清空现有内容
          transactionList.innerHTML = '';
          
          // 添加交易记录
          data.transactions.forEach(transaction => {
            const date = new Date(transaction.createdAt).toLocaleString();
            const transactionItem = document.createElement('div');
            transactionItem.className = 'transaction-item';
            
            // 判断交易类型（增加或减少）
            const isCredit = transaction.amount > 0;
            const amountClass = isCredit ? 'credit-amount' : 'debit-amount';
            
            transactionItem.innerHTML = `
              <div class="transaction-date">${date}</div>
              <div class="transaction-description">${transaction.description}</div>
              <div class="transaction-amount ${amountClass}">
                ${isCredit ? '+' : ''}${transaction.amount} 积分
              </div>
            `;
            
            transactionList.appendChild(transactionItem);
          });
        } else {
          transactionList.innerHTML = '<p class="empty-list">暂无交易记录</p>';
        }
      }
    } catch (error) {
      console.error('获取交易历史失败:', error);
      transactionList.innerHTML = '<p class="empty-list">加载交易记录失败</p>';
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
});
