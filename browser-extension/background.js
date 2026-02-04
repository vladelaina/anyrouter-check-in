let capturedData = {};
let isInitialized = false;

// 初始化时从本地存储加载已有的数据
chrome.storage.local.get('capturedData', (result) => {
  if (result.capturedData) {
    capturedData = result.capturedData;
  }
  isInitialized = true;
});

// 监听请求头以捕获 new-api-user
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    // 确保数据已从存储加载
    if (!isInitialized) return;

    const apiUserHeader = details.requestHeaders.find(h => h.name.toLowerCase() === 'new-api-user');

    if (apiUserHeader) {
      const url = new URL(details.url);
      const domain = url.hostname;

      // 只要是 new-api 站点，我们就记录或更新
      if (!capturedData[domain] || capturedData[domain].api_user !== apiUserHeader.value) {
        capturedData[domain] = {
          ...capturedData[domain],
          url: url.origin,
          api_user: apiUserHeader.value
        };
        saveData();
      }
    }
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders", "extraHeaders"] // 加入 extraHeaders 增强捕获能力
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
