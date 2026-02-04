document.addEventListener('DOMContentLoaded', async () => {
  const content = document.getElementById('content');
  const status = document.getElementById('status');
  const copyAccountsBtn = document.getElementById('copyAccounts');
  const clearBtn = document.getElementById('clearData');
  const remarkInput = document.getElementById('remarkInput');
  const debugLog = document.getElementById('debugLog');

  let currentAccounts = [];

  function log(msg) {
    console.log(msg);
    debugLog.style.display = 'block';
    const div = document.createElement('div');
    div.innerText = `> ${msg}`;
    debugLog.appendChild(div);
  }

  log('Popup 启动中...');

  // 加载保存的备注
  try {
    const { globalRemark } = await chrome.storage.local.get('globalRemark');
    if (globalRemark) {
      remarkInput.value = globalRemark;
      log('已加载备注: ' + globalRemark);
    }
  } catch (e) {
    log('加载备注失败: ' + e.message);
  }

  // 监听备注输入
  remarkInput.addEventListener('input', (e) => {
    chrome.storage.local.set({ globalRemark: e.target.value });
    refreshUI();
  });

  async function refreshUI() {
    const { capturedData } = await chrome.storage.local.get('capturedData');
    renderData(capturedData || {});
  }

  // 获取数据
  log('正在连接后台脚本...');
  chrome.runtime.sendMessage({ action: "refreshCookies" }, async (response) => {
    if (chrome.runtime.lastError) {
      log('消息错误: ' + chrome.runtime.lastError.message);
    } else {
      log('后台响应成功');
    }

    const { capturedData } = await chrome.storage.local.get('capturedData');
    log('存储中的站点数: ' + Object.keys(capturedData || {}).length);
    renderData(capturedData || {});
  });

  clearBtn.onclick = () => {
    if (confirm('确定要清空所有数据吗？')) {
      chrome.runtime.sendMessage({ action: "clearData" }, () => {
        location.reload();
      });
    }
  };

  function renderData(data) {
    const stats = document.getElementById('stats');
    const remark = remarkInput.value.trim();
    content.innerHTML = '';
    currentAccounts = [];

    const domains = Object.keys(data);
    const validDomains = domains.filter(d => data[d].api_user && data[d].session);

    stats.innerText = `已捕获站点总数: ${validDomains.length}`;
    log(`渲染: 总计 ${domains.length} 个记录, 有效 ${validDomains.length} 个`);

    if (domains.length === 0) {
      content.innerHTML = '<p style="color: #666;">未捕获到任何数据。请访问 NewAPI 站点并刷新页面。</p>';
      return;
    }

    for (const domain of domains) {
      const info = data[domain];
      log(`检查 [${domain}]: UserID=${!!info.api_user}, Session=${!!info.session}`);

      if (!info.api_user || !info.session) {
        content.innerHTML += `
          <div class="account-card" style="border-color: #ffcccc; opacity: 0.7;">
            <div class="label">${domain}</div>
            <div style="color: #dc3545; font-size: 11px;">
              ${!info.api_user ? '⚠️ 缺用户 ID (请确保已登录并刷新)' : ''}
              ${!info.session ? '⚠️ 缺 Session (请确保已登录)' : ''}
            </div>
          </div>`;
        continue;
      }

      const displayName = remark ? `${remark}_${domain}` : domain;
      currentAccounts.push({
        name: displayName,
        url: info.url,
        sign_in_path: info.sign_in_path || '/api/user/sign_in',
        api_user: info.api_user,
        cookies: { session: info.session }
      });

      content.innerHTML += `
        <div class="account-card">
          <div class="label">备注: <span style="color: #28a745;">${displayName}</span></div>
          <div class="label">签到路径: <span style="color: #007bff; font-size: 11px;">${info.sign_in_path || '/api/user/sign_in'}</span></div>
          <div class="label">用户 ID: <span class="value">${info.api_user}</span></div>
        </div>`;
    }

    copyAccountsBtn.onclick = () => {
      if (currentAccounts.length === 0) {
        log('错误: 没有有效账号可复制');
        return;
      }
      navigator.clipboard.writeText(JSON.stringify(currentAccounts, null, 2)).then(() => {
        status.innerText = '✅ 已复制！';
        setTimeout(() => status.innerText = '', 2000);
      });
    };
  }
});
