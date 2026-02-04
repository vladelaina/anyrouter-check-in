let capturedData = {};
let isInitialized = false;

// 初始化时从本地存储加载已有的数据
chrome.storage.local.get('capturedData', (result) => {
  if (result.capturedData) {
    capturedData = result.capturedData;
  }
  isInitialized = true;
});

// 监听请求以捕获 new-api-user 和 签到路径
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (!isInitialized) return;

    const apiUserHeader = details.requestHeaders.find(h => h.name.toLowerCase() === 'new-api-user');
    const url = new URL(details.url);
    const domain = url.hostname;

    // 1. 捕获 User ID
    if (apiUserHeader) {
      if (!capturedData[domain] || capturedData[domain].api_user !== apiUserHeader.value) {
        capturedData[domain] = {
          ...capturedData[domain],
          url: url.origin,
          api_user: apiUserHeader.value
        };
        saveData();
      }
    }

    // 2. 捕获签到路径 (通常是 POST 请求，路径包含 sign_in 或 checkin)
    if (details.method === 'POST' && (url.pathname.includes('sign_in') || url.pathname.includes('checkin'))) {
      if (capturedData[domain]) {
        capturedData[domain].sign_in_path = url.pathname;
        saveData();
      }
    }
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders", "extraHeaders"]
);

function saveData() {
  chrome.storage.local.set({ capturedData });
}

// 处理来自 Popup 或 Content Script 的请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "refreshCookies") {
    updateCookies().then(() => sendResponse({ status: "done" }));
    return true;
  }
  // ... 其他逻辑保持不变
  if (request.action === "saveUsername") {
    if (capturedData[request.domain]) {
      capturedData[request.domain].username = request.username;
      saveData();
    }
    return;
  }
  if (request.action === "clearData") {
    capturedData = {};
    saveData();
    sendResponse({ status: "done" });
    return;
  }
});

async function updateCookies() {
  const domains = Object.keys(capturedData);
  for (const domain of domains) {
    const cookies = await chrome.cookies.getAll({ domain });
    const sessionCookie = cookies.find(c => c.name === 'session');
    if (sessionCookie) {
      capturedData[domain].session = sessionCookie.value;
    }
  }
  saveData();
}
