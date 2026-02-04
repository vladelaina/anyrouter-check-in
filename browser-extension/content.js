// 尝试从页面中抓取用户名
function findUsername() {
  // 针对 NewAPI 常见的布局：右上角用户菜单或侧边栏
  const selectors = [
    '.user-name',
    '#username',
    '.profile-name',
    'span[title="User"]',
    '.ant-dropdown-link' // 常见的 Ant Design 下拉菜单
  ];

  for (const s of selectors) {
    const el = document.querySelector(s);
    if (el && el.innerText.trim()) {
      return el.innerText.trim();
    }
  }

  // 备选方案：尝试从页面文本查找
  const bodyText = document.body.innerText;
  const match = bodyText.match(/你好，(.*?)\s|Hello, (.*?)\s/);
  if (match) return match[1] || match[2];

  return null;
}

const username = findUsername();
if (username) {
  chrome.runtime.sendMessage({
    action: "saveUsername",
    domain: window.location.hostname,
    username: username
  });
}
