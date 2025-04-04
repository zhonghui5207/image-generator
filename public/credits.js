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
      
      // 显示模态框
      paymentModal.style.display = 'block';
      
      // 添加模态框动画效果
      setTimeout(() => {
        document.querySelector('.modal-content').style.opacity = '1';
        document.querySelector('.modal-content').style.transform = 'translateY(0)';
      }, 10);
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
      
      // 禁用按钮防止重复点击
      confirmPaymentBtn.disabled = true;
      confirmPaymentBtn.textContent = '处理中...';
      
      let retryCount = 0;
      const maxRetries = 3;
      let success = false;
      
      while (!success && retryCount < maxRetries) {
        try {
          // 套餐ID映射：将字符串ID映射到数字ID
          let packageId;
          switch (selectedPackage.id) {
            case 'basic':
              packageId = 1;
              break;
            case 'standard':
              packageId = 2;
              break;
            case 'premium':
              packageId = 3;
              break;
            default:
              alert('无效的套餐ID');
              confirmPaymentBtn.disabled = false;
              confirmPaymentBtn.textContent = '确认支付';
              return;
          }
          
          // 发送购买请求到支付系统创建订单
          const response = await fetch('/api/payment/create-order', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              packageId: packageId,
              paymentMethod: 'wechat' // 固定使用微信支付
            })
          });
          
          const data = await response.json();
          
          if (response.ok && data.success) {
            // 标记成功，退出循环
            success = true;
            
            // 关闭当前模态框
            paymentModal.style.display = 'none';
            
            // 打开二维码支付页面
            window.location.href = `/payment.html?order=${data.order.orderNumber}`;
          } else {
            // 检查是否是订单号重复错误或需要重试的错误
            const needRetry = data.needRetry || 
              (data.error && (
                data.error.includes('订单号重复') || 
                data.error.includes('201')
              )) ||
              (data.payment && data.payment.needRetry);
            
            if (needRetry && retryCount < maxRetries - 1) {
              // 如果需要重试且未达到最大重试次数
              retryCount++;
              console.log(`创建订单失败，正在重试 (${retryCount}/${maxRetries}): ${data.message}`);
              confirmPaymentBtn.textContent = `正在重试 (${retryCount}/${maxRetries})...`;
              
              // 稍微等待一下再重试
              await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
              // 重试次数已达上限或无需重试
              alert(`创建订单失败: ${data.message || '请稍后再试'}`);
              confirmPaymentBtn.disabled = false;
              confirmPaymentBtn.textContent = '确认支付';
              return;
            }
          }
        } catch (error) {
          console.error('购买积分错误:', error);
          
          if (retryCount < maxRetries - 1) {
            // 如果未达到最大重试次数，继续重试
            retryCount++;
            console.log(`请求失败，正在重试 (${retryCount}/${maxRetries})`);
            confirmPaymentBtn.textContent = `正在重试 (${retryCount}/${maxRetries})...`;
            
            // 稍微等待一下再重试
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            // 重试次数已达上限
            alert('购买请求失败，请稍后再试');
            confirmPaymentBtn.disabled = false;
            confirmPaymentBtn.textContent = '确认支付';
            return;
          }
        }
      }
      
      // 如果所有重试都失败
      if (!success) {
        confirmPaymentBtn.disabled = false;
        confirmPaymentBtn.textContent = '确认支付';
        alert('创建订单失败，请稍后再试');
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
    // 获取DOM元素
    const purchaseList = document.getElementById('purchase-list');
    if (!purchaseList) return;
    
    try {
      // 显示加载中状态
      purchaseList.innerHTML = '<p class="loading-message"><i class="fas fa-spinner fa-spin"></i> 正在加载购买记录...</p>';
      
      // 尝试获取购买记录
      const response = await fetch('/api/credits/purchases', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // 处理数据
        if (data.purchases && data.purchases.length > 0) {
          displayPurchaseRecords(data.purchases);
        } else {
          // 没有记录
          purchaseList.innerHTML = '<p class="empty-list">暂无购买记录</p>';
        }
      } else {
        // API调用失败
        purchaseList.innerHTML = '<p class="empty-list">暂无购买记录</p>';
      }
    } catch (error) {
      console.error('获取购买记录失败:', error);
      purchaseList.innerHTML = '<p class="empty-list">暂无购买记录</p>';
    }
  }
  
  // 显示购买记录
  function displayPurchaseRecords(records) {
    const purchaseList = document.getElementById('purchase-list');
    if (!purchaseList) return;
    
    if (records && records.length > 0) {
      // 清空现有内容
      purchaseList.innerHTML = '';
      
      // 添加购买记录
      records.forEach(record => {
        const date = new Date(record.createdAt).toLocaleString();
        const item = document.createElement('div');
        item.className = 'transaction-item';
        
        item.innerHTML = `
          <div class="transaction-date">${date}</div>
          <div class="transaction-details">${record.description || '购买积分'}</div>
          <div class="transaction-amount positive">+${record.amount} 积分</div>
        `;
        
        purchaseList.appendChild(item);
      });
    } else {
      // 显示没有购买记录的提示
      purchaseList.innerHTML = '<p class="empty-list">暂无购买记录</p>';
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
