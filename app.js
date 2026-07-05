// ==========================================================================
// 1. PWA Service Worker 註冊
// ==========================================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('Service Worker 註冊成功', reg.scope))
      .catch((err) => console.log('Service Worker 註冊失敗', err));
  });

  // 監聽 Service Worker 控制權改變，自動重新整理以載入最新快取代碼
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

// 網路狀態監測
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

function updateOnlineStatus() {
  const badge = document.getElementById('network-status');
  if (navigator.onLine) {
    badge.innerHTML = '<i class="fa-solid fa-cloud"></i> 離線可用';
    badge.style.opacity = '1';
  } else {
    badge.innerHTML = '<i class="fa-solid fa-cloud-sun"></i> 離線模式';
    badge.style.opacity = '0.7';
  }
}

// ==========================================================================
// 2. 應用程式狀態 (State) 與資料初始化
// ==========================================================================
const DEFAULT_CATEGORIES = [
  { id: 'cat-food', name: '食', emoji: '🍔', color: '#ef4444', type: 'expense' },
  { id: 'cat-clothing', name: '衣', emoji: '👕', color: '#f97316', type: 'expense' },
  { id: 'cat-housing', name: '住', emoji: '🏠', color: '#eab308', type: 'expense' },
  { id: 'cat-traffic', name: '行', emoji: '🚗', color: '#10b981', type: 'expense' },
  { id: 'cat-edu', name: '育', emoji: '📚', color: '#06b6d4', type: 'expense' },
  { id: 'cat-entertainment', name: '樂', emoji: '🎮', color: '#3b82f6', type: 'expense' },
  { id: 'cat-income', name: '收入', emoji: '💰', color: '#a855f7', type: 'income' }
];

const DEFAULT_TRANSACTIONS = [
  { id: 't-1', title: '吃午餐八方雲集', amount: 110, categoryId: 'cat-food', date: getTodayDateTimeString() },
  { id: 't-2', title: '發薪水啦', amount: 48000, categoryId: 'cat-income', date: getTodayDateTimeString() },
  { id: 't-3', title: '捷運加值', amount: 200, categoryId: 'cat-traffic', date: getTodayDateTimeString() }
];

let state = {
  transactions: JSON.parse(localStorage.getItem('smartbook_transactions')) || DEFAULT_TRANSACTIONS,
  categories: JSON.parse(localStorage.getItem('smartbook_categories')) || DEFAULT_CATEGORIES,
  currency: localStorage.getItem('smartbook_currency') || 'TWD',
  exchangeRates: JSON.parse(localStorage.getItem('smartbook_rates')) || { TWD: 1, USD: 31, JPY: 0.20, EUR: 33, CNY: 4.3, HKD: 4.0, KRW: 0.024, THB: 0.90, GBP: 40.0, AUD: 21.0, SGD: 23.0 },
  gasUrl: localStorage.getItem('smartbook_gas_url') || '',
  theme: localStorage.getItem('smartbook_theme') || 'indigo',
  bgTheme: localStorage.getItem('smartbook_bg_theme') || 'dark',
  fontScale: parseFloat(localStorage.getItem('smartbook_font_scale')) || 1.0,
  editingTxId: null,
  queryStart: null,
  queryEnd: null,
  userName: localStorage.getItem('smartbook_username') || '預設記帳人'
};

let CURRENCY_SYMBOLS = JSON.parse(localStorage.getItem('smartbook_currency_symbols')) || {
  TWD: 'NT$',
  USD: 'US$',
  JPY: 'JP¥',
  EUR: '€',
  CNY: 'CN¥',
  HKD: 'HK$',
  KRW: '₩',
  THB: '฿',
  GBP: '£',
  AUD: 'A$',
  SGD: 'S$'
};

let CURRENCY_CHINESE = JSON.parse(localStorage.getItem('smartbook_currency_chinese')) || {
  TWD: '新台幣',
  USD: '美金',
  JPY: '日圓',
  EUR: '歐元',
  CNY: '人民幣',
  HKD: '港幣',
  KRW: '韓元',
  THB: '泰銖',
  GBP: '英鎊',
  AUD: '澳幣',
  SGD: '新加坡幣'
};

let CURRENCY_CODES = JSON.parse(localStorage.getItem('smartbook_currency_codes')) || {
  '新台幣': 'TWD',
  '美金': 'USD',
  '日圓': 'JPY',
  '歐元': 'EUR',
  '人民幣': 'CNY',
  '港幣': 'HKD',
  '韓元': 'KRW',
  '泰銖': 'THB',
  '英鎊': 'GBP',
  '澳幣': 'AUD',
  '新加坡幣': 'SGD'
};

function getCurrencySymbol() {
  const cur = state.currency || 'TWD';
  return CURRENCY_SYMBOLS[cur] || 'NT$';
}

function convertCurrency(amount, fromCur, toCur) {
  if (!fromCur) fromCur = 'TWD';
  if (!toCur) toCur = 'TWD';
  if (fromCur === toCur) return amount;
  const rates = state.exchangeRates || { TWD: 1, USD: 31, JPY: 0.20, EUR: 33, CNY: 4.3 };
  const amountInTwd = amount * (rates[fromCur] || 1);
  const targetRate = rates[toCur] || 1;
  return amountInTwd / targetRate;
}

// 儲存狀態至本地
function saveState() {
  localStorage.setItem('smartbook_transactions', JSON.stringify(state.transactions));
  localStorage.setItem('smartbook_categories', JSON.stringify(state.categories));
  localStorage.setItem('smartbook_currency', state.currency);
  localStorage.setItem('smartbook_rates', JSON.stringify(state.exchangeRates));
  localStorage.setItem('smartbook_currency_symbols', JSON.stringify(CURRENCY_SYMBOLS));
  localStorage.setItem('smartbook_currency_chinese', JSON.stringify(CURRENCY_CHINESE));
  localStorage.setItem('smartbook_currency_codes', JSON.stringify(CURRENCY_CODES));
  localStorage.setItem('smartbook_gas_url', state.gasUrl);
  localStorage.setItem('smartbook_theme', state.theme);
  localStorage.setItem('smartbook_bg_theme', state.bgTheme);
  localStorage.setItem('smartbook_font_scale', state.fontScale);
  localStorage.setItem('smartbook_username', state.userName);
}

// 取得今天日期字串 (YYYY-MM-DD)
function getTodayDateString() {
  const d = new Date();
  const month = '' + (d.getMonth() + 1);
  const day = '' + d.getDate();
  const year = d.getFullYear();
  return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
}

function getTodayDateTimeString() {
  const d = new Date();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const seconds = d.getSeconds().toString().padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// ==========================================================================
// 3. 智慧自然語言解析器 (NLP Parser)
// ==========================================================================
const KEYWORDS_MAPPING = {
  'cat-food': ['食', '飯', '麵', '早餐', '午餐', '晚餐', '飲料', '咖啡', '甜點', '超商', '吃', '喝', '茶', '點心', '麥當勞', '火鍋', '宵夜'],
  'cat-clothing': ['衣', '鞋', '帽', '買衣服', '褲子', '外套', '包包', '配件', '眼鏡', '手錶', '服飾'],
  'cat-housing': ['住', '房租', '水電', '瓦斯', '網路', '管理費', '裝潢', '家具', '房', '租金', '日常用品', '洗潔精', '衛生紙'],
  'cat-traffic': ['行', '車', '捷運', '公車', '火車', '高鐵', '計程車', '加油', '機車', '腳踏車', '悠遊卡', '加值', 'uber', '油錢'],
  'cat-edu': ['育', '書', '學費', '課程', '補習', '演講', '文具', '報紙', '雜誌', '文具', '考試'],
  'cat-entertainment': ['樂', '玩', '樂', '電影', '遊戲', '門票', '旅遊', '唱歌', '展覽', '運動', '健身', 'KTV', '玩具', '追劇', '按摩'],
  'cat-income': ['薪水', '獎金', '投資', '利息', '紅包', '外快', '賣東西', '收入', '兼職', '理財', '零用錢']
};

function parseSmartInput(inputStr) {
  if (!inputStr) return null;
  
  // 1. 提取金額與幣別
  let matchedCurrency = state.currency || 'TWD';
  const inputLower = inputStr.toLowerCase();
  
  if (inputLower.includes('美金') || inputLower.includes('美元') || inputLower.includes('usd') || inputLower.includes('us$')) {
    matchedCurrency = 'USD';
  } else if (inputLower.includes('日圓') || inputLower.includes('日幣') || inputLower.includes('jpy') || inputLower.includes('jp¥') || inputLower.includes('日元')) {
    matchedCurrency = 'JPY';
  } else if (inputLower.includes('歐元') || inputLower.includes('eur') || inputLower.includes('€')) {
    matchedCurrency = 'EUR';
  } else if (inputLower.includes('人民幣') || inputLower.includes('cny') || inputLower.includes('cn¥') || inputLower.includes('rmb')) {
    matchedCurrency = 'CNY';
  } else if (inputLower.includes('台幣') || inputLower.includes('新台幣') || inputLower.includes('twd') || inputLower.includes('nt$')) {
    matchedCurrency = 'TWD';
  }

  // 提取數字作為金額
  const numbers = inputStr.match(/\d+(\.\d+)?/g);
  let amount = 0;
  if (numbers && numbers.length > 0) {
    amount = parseFloat(numbers[numbers.length - 1]);
  }

  // 2. 判斷類別 (基於關鍵字比對)
  let matchedCategoryId = 'cat-food'; // 預設為 食
  let maxMatches = 0;

  // 比對所有類別的關鍵字
  state.categories.forEach(cat => {
    let matches = 0;
    if (inputStr.includes(cat.name)) {
      matches += 3;
    }
    
    const kws = KEYWORDS_MAPPING[cat.id] || [];
    kws.forEach(kw => {
      if (inputStr.includes(kw)) {
        matches++;
      }
    });

    if (matches > maxMatches) {
      maxMatches = matches;
      matchedCategoryId = cat.id;
    }
  });

  // 3. 提取品項名稱 (過濾掉數字、單位、幣別名稱等)
  let title = inputStr;
  
  // 移除數字（支援小數點）
  title = title.replace(/\d+(\.\d+)?/g, '');
  
  // 移除幣別關鍵字
  const currencyKeywords = ['美金', '美元', '日幣', '日圓', '日元', '歐元', '人民幣', '台幣', '新台幣', 'usd', 'jpy', 'eur', 'cny', 'rmb'];
  currencyKeywords.forEach(kw => {
    title = title.split(kw).join('');
    title = title.split(kw.toUpperCase()).join('');
  });

  // 移除常見的助詞、動詞、單位
  const removeWords = ['元', '塊', '元整', '花費', '花了', '支出', '記帳', '賺了', '收入', '新增', '項目', '一個', '一筆', '塊錢', '新台幣', '的', '了', '花'];
  removeWords.forEach(w => {
    title = title.split(w).join('');
  });
  
  title = title.trim();
  if (!title) {
    const cat = state.categories.find(c => c.id === matchedCategoryId);
    title = cat ? cat.name : '記帳項目';
  }

  return {
    title: title,
    amount: amount,
    categoryId: matchedCategoryId,
    currency: matchedCurrency,
    date: getTodayDateTimeString()
  };
}

// ==========================================================================
// 4. HTML5 Web Speech 語音輸入控制
// ==========================================================================
let recognition = null;
let isRecording = false;

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('此瀏覽器不支援 Web Speech API (語音輸入功能)。');
    return false;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'zh-TW';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isRecording = true;
    document.getElementById('voice-box').classList.add('recording');
    document.getElementById('mic-status').innerText = '正在聆聽中...請說話';
    document.getElementById('speech-result-preview').innerText = '';
  };

  recognition.onresult = (e) => {
    const resultText = e.results[0][0].transcript;
    document.getElementById('speech-result-preview').innerText = `聽到的內容：「${resultText}」`;
    
    // 解析語音內容
    const parsed = parseSmartInput(resultText);
    if (parsed) {
      showConfirmCard(parsed);
    }
  };

  recognition.onerror = (e) => {
    console.error('語音識別錯誤', e.error);
    let errorMsg = '語音識別失敗，請再試一次';
    if (e.error === 'not-allowed') {
      errorMsg = '麥克風權限被拒絕，請開啟權限。';
    } else if (e.error === 'no-speech') {
      errorMsg = '沒有偵測到說話聲音。';
    }
    document.getElementById('mic-status').innerText = errorMsg;
  };

  recognition.onend = () => {
    isRecording = false;
    document.getElementById('voice-box').classList.remove('recording');
    if (document.getElementById('mic-status').innerText === '正在聆聽中...請說話') {
      document.getElementById('mic-status').innerText = '點擊麥克風開始說話';
    }
  };

  return true;
}

function toggleRecording() {
  if (!recognition) {
    if (!initSpeechRecognition()) {
      alert('抱歉，您的裝置或瀏覽器不支援語音識別記帳，請使用打字輸入。');
      return;
    }
  }

  if (isRecording) {
    recognition.stop();
  } else {
    // iOS Safari 需要在用戶點擊的事件同步調用麥克風
    recognition.start();
  }
}

// ==========================================================================
// 5. UI 渲染功能
// ==========================================================================

// 5.1 頁籤導覽切換
const navItems = document.querySelectorAll('.nav-item');
const tabs = document.querySelectorAll('.content-tab');

navItems.forEach(item => {
  item.addEventListener('click', () => {
    const targetTabId = item.getAttribute('data-tab');
    
    // 更新導覽欄啟動狀態
    navItems.forEach(nav => nav.classList.remove('active'));
    item.classList.add('active');
    
    // 更新分頁顯示狀態
    tabs.forEach(tab => {
      if (tab.id === targetTabId) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // 切換至首頁或設定頁時重新加載資料
    if (targetTabId === 'tab-dashboard') {
      renderDashboard();
    } else if (targetTabId === 'tab-settings') {
      renderCategories();
      renderCharts();
    }
  });
});

// 5.2 渲染首頁總覽與歷史列表
function renderDashboard() {
  const filterSelect = document.getElementById('user-filter-select');
  if (filterSelect) {
    const prevVal = filterSelect.value || 'all';
    filterSelect.innerHTML = '<option value="all">合併計算 (全部)</option>';
    
    const uniqueUsers = [...new Set(state.transactions.map(t => t.user).filter(Boolean))];
    uniqueUsers.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.innerText = `僅看: ${u}`;
      filterSelect.appendChild(opt);
    });
    
    if (uniqueUsers.includes(prevVal) || prevVal === 'all') {
      filterSelect.value = prevVal;
    } else {
      filterSelect.value = 'all';
    }
  }

  let totalIncome = 0;
  let totalExpense = 0;
  let currentMonthTransactions = [];

  const now = new Date();
  
  if (state.queryStart && state.queryEnd) {
    // 區間查詢篩選
    document.getElementById('current-month-year').innerText = `${state.queryStart} ~ ${state.queryEnd}`;
    currentMonthTransactions = state.transactions.filter(t => {
      const tDateStr = t.date ? t.date.split(' ')[0] : '';
      return tDateStr >= state.queryStart && tDateStr <= state.queryEnd;
    });
  } else {
    // 預設當月重設歸0
    document.getElementById('current-month-year').innerText = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月`;
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11
    
    currentMonthTransactions = state.transactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate.getFullYear() === currentYear && tDate.getMonth() === currentMonth;
    });
  }

  // 篩選指定記帳人
  const selectedUser = filterSelect ? filterSelect.value : 'all';
  if (selectedUser !== 'all') {
    currentMonthTransactions = currentMonthTransactions.filter(t => t.user === selectedUser);
  }

  // 排序：日期由新到舊，若日期相同則以 id 倒序
  currentMonthTransactions.sort((a, b) => {
    if (b.date !== a.date) {
      return new Date(b.date) - new Date(a.date);
    }
    return b.id.localeCompare(a.id);
  });

  // 計算金額
  currentMonthTransactions.forEach(t => {
    const cat = state.categories.find(c => c.id === t.categoryId);
    if (cat) {
      const convertedAmount = convertCurrency(t.amount, t.currency || 'TWD', state.currency);
      if (cat.type === 'income') {
        totalIncome += convertedAmount;
      } else {
        totalExpense += convertedAmount;
      }
    }
  });

  const balance = totalIncome - totalExpense;

  // 更新介面
  const symbol = getCurrencySymbol();
  document.getElementById('total-balance').innerText = `${symbol}${balance.toLocaleString()}`;
  document.getElementById('total-income').innerText = `${symbol}${totalIncome.toLocaleString()}`;
  document.getElementById('total-expense').innerText = `${symbol}${totalExpense.toLocaleString()}`;

  // 渲染交易列表
  const listContainer = document.getElementById('transactions-list');
  listContainer.innerHTML = '';

  if (currentMonthTransactions.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-receipt"></i>
        <p>此月份尚無記帳資料</p>
        <span>點擊下方麥克風或加號開始記帳吧！</span>
      </div>
    `;
    return;
  }

  currentMonthTransactions.forEach(t => {
    const cat = state.categories.find(c => c.id === t.categoryId) || { name: '其他', emoji: '📝', color: '#94a3b8', type: 'expense' };
    const isIncome = cat.type === 'income';
    const txSymbol = CURRENCY_SYMBOLS[t.currency || 'TWD'] || 'NT$';

    const itemHtml = `
      <div class="transaction-item" data-id="${t.id}">
        <div class="item-left">
          <div class="category-icon-wrapper" style="background-color: ${cat.color}20; color: ${cat.color};">
            ${cat.emoji}
          </div>
          <div class="item-info">
            <span class="item-title">${escapeHtml(t.title)}</span>
            <div class="item-meta">
              <span class="item-date">${t.date ? t.date.substring(0, 16) : ''}</span>
              <span class="item-category-tag">${cat.name}</span>
              ${t.user ? `<span class="item-user-tag" style="background: rgba(99,102,241,0.12); color: var(--primary); padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; margin-left: 5px; display: inline-flex; align-items: center; gap: 2px;"><i class="fa-solid fa-user" style="font-size: 8px;"></i> ${escapeHtml(t.user)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="item-right" style="display: flex; align-items: center; gap: 6px;">
          <span class="item-amount ${isIncome ? 'income' : 'expense'}" style="margin-right: 2px;">
            ${isIncome ? '+' : '-'}${txSymbol}${t.amount.toLocaleString()}
          </span>
          <button class="btn-edit-item" onclick="editTransaction('${t.id}')">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn-delete-item" onclick="deleteTransaction('${t.id}')">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    `;
    listContainer.insertAdjacentHTML('beforeend', itemHtml);
  });
}

// 5.3 渲染設定頁類別網格
function renderCategories() {
  const container = document.getElementById('category-list');
  container.innerHTML = '';

  state.categories.forEach(cat => {
    // 預設的類別不顯示刪除按鈕，保護基礎資料
    const isDefault = DEFAULT_CATEGORIES.some(dc => dc.id === cat.id);
    const deleteBtnHtml = isDefault ? '' : `<button class="btn-delete-cat" onclick="deleteCategory('${cat.id}', event)">&times;</button>`;

    const cardHtml = `
      <div class="category-badge-item" style="border: 1px solid ${cat.color}30;">
        ${deleteBtnHtml}
        <div class="badge-icon" style="background-color: ${cat.color}20; color: ${cat.color};">
          ${cat.emoji}
        </div>
        <span class="badge-name">${escapeHtml(cat.name)}</span>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', cardHtml);
  });

  // 更新確認確認卡片上的類別下拉選單
  updateCategoryDropdown();
}

// 5.4 更新下拉選單
function updateCategoryDropdown() {
  const dropdown = document.getElementById('confirm-category');
  if (!dropdown) return;
  
  dropdown.innerHTML = '';
  state.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = `${cat.emoji} ${cat.name} (${cat.type === 'income' ? '收' : '支'})`;
    dropdown.appendChild(opt);
  });
}

// 5.5 渲染圖表長條圖
function renderCharts() {
  const chartContainer = document.getElementById('chart-bars');
  chartContainer.innerHTML = '';

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // 統計各類別的總支出
  const expenseMap = {};
  let totalExpense = 0;

  // 初始化所有支出類別為 0
  state.categories.forEach(cat => {
    if (cat.type === 'expense') {
      expenseMap[cat.id] = 0;
    }
  });

  // 取得篩選後的交易明細
  let filteredTransactions = state.transactions;

  // 1. 日期區間篩選
  if (state.queryStart && state.queryEnd) {
    filteredTransactions = filteredTransactions.filter(t => {
      const tDateStr = t.date ? t.date.split(' ')[0] : '';
      return tDateStr >= state.queryStart && tDateStr <= state.queryEnd;
    });
  } else {
    filteredTransactions = filteredTransactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate.getFullYear() === currentYear && tDate.getMonth() === currentMonth;
    });
  }

  // 2. 記帳人篩選
  const filterSelect = document.getElementById('user-filter-select');
  const selectedUser = filterSelect ? filterSelect.value : 'all';
  if (selectedUser !== 'all') {
    filteredTransactions = filteredTransactions.filter(t => t.user === selectedUser);
  }

  // 計算當月/該區間支出總和
  filteredTransactions.forEach(t => {
    const cat = state.categories.find(c => c.id === t.categoryId);
    if (cat && cat.type === 'expense') {
      const convertedAmount = convertCurrency(t.amount, t.currency || 'TWD', state.currency);
      expenseMap[t.categoryId] = (expenseMap[t.categoryId] || 0) + convertedAmount;
      totalExpense += convertedAmount;
    }
  });

  if (totalExpense === 0) {
    document.getElementById('chart-placeholder').className = 'chart-placeholder empty';
    document.getElementById('chart-placeholder').innerHTML = '<p><i class="fa-solid fa-chart-line"></i> 當月尚無支出，無法顯示比例圖</p>';
    return;
  }

  document.getElementById('chart-placeholder').className = 'chart-placeholder';
  document.getElementById('chart-placeholder').innerHTML = '<div class="chart-bar-list" id="chart-bars"></div>';
  const newBarsContainer = document.getElementById('chart-bars');

  // 將類別依支出從高到低排序並顯示
  const sortedCategories = Object.keys(expenseMap)
    .map(key => {
      const cat = state.categories.find(c => c.id === key);
      return {
        id: key,
        name: cat ? cat.name : '其他',
        emoji: cat ? cat.emoji : '📝',
        color: cat ? cat.color : '#94a3b8',
        amount: expenseMap[key]
      };
    })
    .filter(item => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  sortedCategories.forEach(item => {
    const percentage = ((item.amount / totalExpense) * 100).toFixed(1);
    const rowHtml = `
      <div class="chart-bar-row">
        <div class="chart-row-info">
          <span class="cat-name">${item.emoji} ${escapeHtml(item.name)}</span>
          <span class="amount-pct">${getCurrencySymbol()}${item.amount.toLocaleString()} (${percentage}%)</span>
        </div>
        <div class="chart-track">
          <div class="chart-fill" style="background-color: ${item.color}; width: ${percentage}%;"></div>
        </div>
      </div>
    `;
    newBarsContainer.insertAdjacentHTML('beforeend', rowHtml);
  });
}

// 輔助函式：防止 XSS
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

// ==========================================================================
// 6. 互動功能與資料控制 (Actions)
// ==========================================================================

// 6.1 刪除單筆帳目
window.deleteTransaction = function(id) {
  if (confirm('確定要刪除此筆記帳嗎？')) {
    state.transactions = state.transactions.filter(t => t.id !== id);
    saveState();
    renderDashboard();
    renderCharts();
    triggerAutoBackup();
  }
};

// 6.1.2 編輯修改單筆帳目
window.editTransaction = function(id) {
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;
  
  state.editingTxId = id;
  
  document.getElementById('confirm-title').value = tx.title;
  document.getElementById('confirm-amount').value = tx.amount;
  document.getElementById('confirm-category').value = tx.categoryId;
  document.getElementById('confirm-currency').value = tx.currency || 'TWD';
  document.getElementById('confirm-date').value = tx.date ? tx.date.split(' ')[0] : getTodayDateString();
  
  document.getElementById('confirm-card-title').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> 編輯修改帳目';
  document.getElementById('btn-confirm-save').innerText = '儲存修改';
  
  // 自動跳轉到「記一筆」頁籤
  document.querySelector('[data-tab="tab-add"]').click();
  
  const card = document.getElementById('parse-confirm-card');
  card.style.display = 'block';
  card.scrollIntoView({ behavior: 'smooth', block: 'end' });
};

// 6.2 清除資料 (打開區間清除彈出視窗)
// 舊有的 btn-clear-history 監聽器移至 DOMContentLoaded 中統一處理

// 6.3 顯示解析確認卡片
function showConfirmCard(parsed) {
  const card = document.getElementById('parse-confirm-card');
  card.style.display = 'block';
  
  document.getElementById('confirm-title').value = parsed.title;
  document.getElementById('confirm-amount').value = parsed.amount;
  document.getElementById('confirm-category').value = parsed.categoryId;
  document.getElementById('confirm-currency').value = parsed.currency || state.currency || 'TWD';
  document.getElementById('confirm-date').value = parsed.date ? parsed.date.split(' ')[0] : getTodayDateString();
  
  // 捲動至確認卡片位置，提升 iOS 體驗
  card.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

// 6.4 取消確認
document.getElementById('btn-confirm-cancel').addEventListener('click', (e) => {
  e.preventDefault();
  state.editingTxId = null;
  document.getElementById('confirm-card-title').innerHTML = '<i class="fa-solid fa-magnifying-glass-chart"></i> 解析確認';
  document.getElementById('btn-confirm-save').innerText = '確認儲存';
  document.getElementById('parse-confirm-card').style.display = 'none';
  document.getElementById('speech-result-preview').innerText = '';
  document.getElementById('text-input').value = '';
});

// 6.5 確認並儲存帳目
document.getElementById('btn-confirm-save').addEventListener('click', (e) => {
  e.preventDefault();
  
  try {
    const title = document.getElementById('confirm-title').value.trim();
    const amount = parseFloat(document.getElementById('confirm-amount').value);
    const categoryId = document.getElementById('confirm-category').value;
    const currency = document.getElementById('confirm-currency').value;
    const date = document.getElementById('confirm-date').value;

    if (!title) {
      alert('品項不能為空！');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      alert('請輸入大於 0 的正確金額！');
      return;
    }
    if (!date) {
      alert('請選擇日期！');
      return;
    }

    if (state.editingTxId) {
      // 編輯修改已存帳目
      const txIndex = state.transactions.findIndex(t => t.id === state.editingTxId);
      if (txIndex !== -1) {
        state.transactions[txIndex].title = title;
        state.transactions[txIndex].amount = amount;
        state.transactions[txIndex].categoryId = categoryId;
        state.transactions[txIndex].currency = currency;
        
        const originalTx = state.transactions[txIndex];
        state.transactions[txIndex].user = originalTx.user || state.userName;
        
        const originalDatePart = originalTx.date ? originalTx.date.split(' ')[0] : '';
        if (originalDatePart === date) {
          state.transactions[txIndex].date = originalTx.date;
        } else {
          const now = new Date();
          const timeStr = [
            now.getHours().toString().padStart(2, '0'),
            now.getMinutes().toString().padStart(2, '0'),
            now.getSeconds().toString().padStart(2, '0')
          ].join(':');
          state.transactions[txIndex].date = `${date} ${timeStr}`;
        }
      }
      state.editingTxId = null;
      document.getElementById('confirm-card-title').innerHTML = '<i class="fa-solid fa-magnifying-glass-chart"></i> 解析確認';
      document.getElementById('btn-confirm-save').innerText = '確認儲存';
    } else {
      const now = new Date();
      const timeStr = [
        now.getHours().toString().padStart(2, '0'),
        now.getMinutes().toString().padStart(2, '0'),
        now.getSeconds().toString().padStart(2, '0')
      ].join(':');
      const dateTimeStr = `${date} ${timeStr}`;

      const newTx = {
        id: 't-' + Date.now(),
        title: title,
        amount: amount,
        categoryId: categoryId,
        currency: currency,
        date: dateTimeStr,
        user: state.userName || '預設記帳人'
      };

      state.transactions.unshift(newTx);
    }

    saveState();
    
    // 用 try-catch 保護渲染部分，防堵渲染出錯導致儲存流程卡死
    try {
      renderDashboard();
    } catch (errDash) {
      console.error("renderDashboard 渲染失敗，但已保存資料:", errDash);
    }
    
    try {
      renderCharts();
    } catch (errChart) {
      console.error("renderCharts 渲染失敗，但已保存資料:", errChart);
    }
    
    try {
      triggerAutoBackup();
    } catch (errBackup) {
      console.error("背景自動同步失敗，但已保存資料:", errBackup);
    }

    // 清空輸入並關閉卡片 (這才是最核心的動作，不應被前面的錯誤中斷)
    document.getElementById('parse-confirm-card').style.display = 'none';
    document.getElementById('speech-result-preview').innerText = '儲存成功！';
    document.getElementById('text-input').value = '';

    if (navigator.vibrate) {
      navigator.vibrate(80);
    }

    setTimeout(() => {
      const dashboardTab = document.querySelector('[data-tab="tab-dashboard"]');
      if (dashboardTab) {
        dashboardTab.click();
      }
    }, 500);

  } catch (err) {
    console.error("儲存按鈕事件中發生未預料的系統錯誤:", err);
    alert("儲存時發生系統錯誤，請在主畫面重新整理後再試: " + err.message);
  }
});

// 6.6 手動文字解析按鈕事件
document.getElementById('btn-parse-text').addEventListener('click', () => {
  const inputStr = document.getElementById('text-input').value.trim();
  if (!inputStr) {
    alert('請先輸入記帳內容！');
    return;
  }

  const parsed = parseSmartInput(inputStr);
  if (parsed) {
    showConfirmCard(parsed);
  } else {
    alert('無法解析此語句，請嘗試輸入：「午餐 120」或「早餐吃蛋餅花了45元」');
  }
});

// 支援打字框按 Enter 鍵直接解析
document.getElementById('text-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('btn-parse-text').click();
  }
});

// 6.7 麥克風點擊按鈕
document.getElementById('btn-mic').addEventListener('click', () => {
  toggleRecording();
});

// ==========================================================================
// 7. 自訂類別 Modal 控制
// ==========================================================================
const categoryModal = document.getElementById('category-modal');
const btnOpenCatModal = document.getElementById('btn-open-category-modal');
const btnCloseCatModal = document.getElementById('btn-close-category-modal');
const btnCancelCat = document.getElementById('btn-cancel-category');
const btnSaveCat = document.getElementById('btn-save-category');

btnOpenCatModal.addEventListener('click', () => {
  categoryModal.classList.add('active');
  document.getElementById('new-cat-name').value = '';
});

function closeCategoryModal() {
  categoryModal.classList.remove('active');
}

btnCloseCatModal.addEventListener('click', closeCategoryModal);
btnCancelCat.addEventListener('click', closeCategoryModal);

// Emoji 與 Color 選擇互動
const emojiOptions = document.querySelectorAll('.emoji-option');
emojiOptions.forEach(opt => {
  opt.addEventListener('click', () => {
    emojiOptions.forEach(o => o.classList.remove('active'));
    opt.classList.add('active');
  });
});

const colorOptions = document.querySelectorAll('.color-option');
colorOptions.forEach(opt => {
  opt.addEventListener('click', () => {
    colorOptions.forEach(o => o.classList.remove('active'));
    opt.classList.add('active');
  });
});

// 儲存新類別
btnSaveCat.addEventListener('click', () => {
  const name = document.getElementById('new-cat-name').value.trim();
  if (!name) {
    alert('請輸入類別名稱！');
    return;
  }
  if (name.length > 6) {
    alert('類別名稱請控制在 6 個字以內！');
    return;
  }

  // 判斷是否名稱重複
  const isDuplicate = state.categories.some(c => c.name === name);
  if (isDuplicate) {
    alert('類別名稱已存在！');
    return;
  }

  const selectedEmoji = document.querySelector('.emoji-option.active').getAttribute('data-emoji');
  const selectedColor = document.querySelector('.color-option.active').getAttribute('data-color');
  const newCatId = 'cat-' + Date.now();

  const newCat = {
    id: newCatId,
    name: name,
    emoji: selectedEmoji,
    color: selectedColor,
    type: 'expense' // 自訂類別預設為支出
  };

  state.categories.push(newCat);
  saveState();
  renderCategories();
  closeCategoryModal();
});

// 刪除自訂類別
window.deleteCategory = function(id, event) {
  event.stopPropagation(); // 阻止氣泡觸發底層卡片點擊
  
  if (confirm('刪除類別會將該類別的所有記帳記錄移除，確定要刪除嗎？')) {
    // 刪除類別
    state.categories = state.categories.filter(c => c.id !== id);
    // 刪除該類別下的交易記錄
    state.transactions = state.transactions.filter(t => t.categoryId !== id);
    
    saveState();
    renderCategories();
  }
};

// ==========================================================================
// 8. 首次啟動與自訂外觀載入
// ==========================================================================
const THEME_PRESETS = {
  indigo: { primary: '#6366f1', glow: 'rgba(99, 102, 241, 0.4)', accent: '#8b5cf6' },
  emerald: { primary: '#10b981', glow: 'rgba(16, 185, 129, 0.4)', accent: '#059669' },
  amber: { primary: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)', accent: '#d97706' },
  rose: { primary: '#ec4899', glow: 'rgba(236, 72, 153, 0.4)', accent: '#db2777' },
  cyan: { primary: '#06b6d4', glow: 'rgba(6, 182, 212, 0.4)', accent: '#0891b2' }
};

const BG_THEME_PRESETS = {
  dark: {
    bg: '#0b0f19',
    card: 'rgba(30, 41, 59, 0.45)',
    border: 'rgba(255, 255, 255, 0.08)',
    textMain: '#f8fafc',
    textMuted: '#94a3b8',
    inputBg: 'rgba(15, 23, 42, 0.6)'
  },
  light: {
    bg: '#f1f5f9',
    card: 'rgba(255, 255, 255, 0.85)',
    border: 'rgba(0, 0, 0, 0.08)',
    textMain: '#0f172a',
    textMuted: '#64748b',
    inputBg: '#ffffff'
  },
  black: {
    bg: '#000000',
    card: 'rgba(20, 20, 25, 0.8)',
    border: 'rgba(255, 255, 255, 0.12)',
    textMain: '#ffffff',
    textMuted: '#a1a1aa',
    inputBg: '#000000'
  }
};

function applyCustomization() {
  // Apply Accent Theme
  const preset = THEME_PRESETS[state.theme] || THEME_PRESETS.indigo;
  document.documentElement.style.setProperty('--primary', preset.primary);
  document.documentElement.style.setProperty('--primary-glow', preset.glow);
  document.documentElement.style.setProperty('--accent', preset.accent);
  
  // Apply Background Theme
  const bgPreset = BG_THEME_PRESETS[state.bgTheme] || BG_THEME_PRESETS.dark;
  document.documentElement.style.setProperty('--bg-color', bgPreset.bg);
  document.documentElement.style.setProperty('--card-bg', bgPreset.card);
  document.documentElement.style.setProperty('--card-border', bgPreset.border);
  document.documentElement.style.setProperty('--text-main', bgPreset.textMain);
  document.documentElement.style.setProperty('--text-muted', bgPreset.textMuted);
  document.documentElement.style.setProperty('--input-bg', bgPreset.inputBg);
  
  // Apply font scale
  document.documentElement.style.setProperty('--font-scale', state.fontScale || 1.0);
  
  const slider = document.getElementById('font-scale-slider');
  const label = document.getElementById('font-scale-value');
  if (slider && label) {
    slider.value = state.fontScale || 1.0;
    label.innerText = Math.round((state.fontScale || 1.0) * 100) + '%';
  }
  
  document.querySelectorAll('.theme-dot').forEach(dot => {
    if (dot.getAttribute('data-theme') === state.theme) {
      dot.classList.add('active');
    } else {
      dot.classList.remove('active');
    }
  });

  document.querySelectorAll('.bg-theme-btn').forEach(btn => {
    if (btn.getAttribute('data-bg') === state.bgTheme) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// 8.3 載入動態幣別下拉選單
function populateCurrencyDropdowns() {
  const confirmSelect = document.getElementById('confirm-currency');
  const defaultSelect = document.getElementById('currency-select');
  
  if (confirmSelect) {
    confirmSelect.innerHTML = '';
    Object.keys(CURRENCY_CHINESE).forEach(code => {
      const symbol = CURRENCY_SYMBOLS[code] || '$';
      const opt = document.createElement('option');
      opt.value = code;
      opt.innerText = `${CURRENCY_CHINESE[code]} (${symbol})`;
      confirmSelect.appendChild(opt);
    });
  }
  
  if (defaultSelect) {
    defaultSelect.innerHTML = '';
    Object.keys(CURRENCY_CHINESE).forEach(code => {
      const symbol = CURRENCY_SYMBOLS[code] || '$';
      const opt = document.createElement('option');
      opt.value = code;
      opt.innerText = `${CURRENCY_CHINESE[code]} (${symbol})`;
      defaultSelect.appendChild(opt);
    });
    defaultSelect.value = state.currency || 'TWD';
  }
}

// 8.4 渲染動態匯率輸入欄位列表
function renderExchangeRates() {
  const container = document.getElementById('exchange-rates-container');
  if (!container) return;
  
  container.innerHTML = '';
  const codes = Object.keys(state.exchangeRates).filter(code => code !== 'TWD');
  
  let rowsHtml = '';
  for (let i = 0; i < codes.length; i += 2) {
    const code1 = codes[i];
    const code2 = codes[i+1];
    
    const name1 = CURRENCY_CHINESE[code1] || code1;
    const val1 = state.exchangeRates[code1];
    const step1 = code1 === 'JPY' ? '0.001' : (code1 === 'KRW' ? '0.0001' : '0.01');
    
    let col2Html = '';
    if (code2) {
      const name2 = CURRENCY_CHINESE[code2] || code2;
      const val2 = state.exchangeRates[code2];
      const step2 = code2 === 'JPY' ? '0.001' : (code2 === 'KRW' ? '0.0001' : '0.01');
      col2Html = `
        <div class="form-group">
          <label>1 ${name2} (${code2}) =</label>
          <input type="number" class="rate-input-field" data-code="${code2}" step="${step2}" value="${val2}" style="width: 100%; box-sizing: border-box; background-color: var(--input-bg); border: 1px solid var(--card-border); border-radius: 10px; padding: 10px 12px; color: var(--text-main); font-family: var(--font-family); font-size: 14px; outline: none;">
        </div>
      `;
    }
    
    rowsHtml += `
      <div class="form-group-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 6px;">
        <div class="form-group">
          <label>1 ${name1} (${code1}) =</label>
          <input type="number" class="rate-input-field" data-code="${code1}" step="${step1}" value="${val1}" style="width: 100%; box-sizing: border-box; background-color: var(--input-bg); border: 1px solid var(--card-border); border-radius: 10px; padding: 10px 12px; color: var(--text-main); font-family: var(--font-family); font-size: 14px; outline: none;">
        </div>
        ${col2Html}
      </div>
    `;
  }
  container.innerHTML = rowsHtml;
}

// 8.6 背景雲端自動同步備份
function triggerAutoBackup() {
  if (!state.gasUrl) return;
  
  const payload = {
    transactions: state.transactions.map(t => {
      const cat = state.categories.find(c => c.id === t.categoryId);
      const txCur = t.currency || 'TWD';
      const isExpense = cat ? cat.type === 'expense' : true;
      const signedAmount = isExpense ? -Math.abs(t.amount) : Math.abs(t.amount);
      return {
        id: t.id,
        title: t.title,
        amount: signedAmount,
        categoryId: cat ? cat.name : '其他',
        currency: CURRENCY_CHINESE[txCur] || '新台幣',
        date: t.date || getTodayDateTimeString(),
        user: t.user || ''
      };
    }),
    settings: {
      categories: state.categories,
      currency: state.currency,
      exchangeRates: state.exchangeRates,
      currencySymbols: CURRENCY_SYMBOLS,
      currencyChinese: CURRENCY_CHINESE,
      currencyCodes: CURRENCY_CODES,
      theme: state.theme,
      bgTheme: state.bgTheme,
      fontScale: state.fontScale
    }
  };
  
  console.log('背景自動備份中...');
  fetch(state.gasUrl, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(data => {
    if (data.status === 'success') {
      console.log('背景自動備份成功，帳目筆數：', data.count);
    } else {
      console.warn('背景自動備份失敗：', data.message);
    }
  })
  .catch(err => {
    console.error('背景自動備份錯誤：', err);
  });
}

// 8.7 開啟 App 時背景自動下載還原 (拉取最新雲端狀態)
function silentCloudSync() {
  if (!state.gasUrl) return;
  
  console.log('偵測到雲端設定，開始下載最新帳目與自訂幣別...');
  
  fetch(state.gasUrl, {
    method: 'GET',
    mode: 'cors'
  })
  .then(res => res.json())
  .then(data => {
    let changed = false;
    
    // 解析並覆蓋還原交易
    if (data.transactions && Array.isArray(data.transactions)) {
      state.transactions = data.transactions.map(t => {
        const cat = state.categories.find(c => c.name === t.categoryId) || state.categories.find(c => c.id === t.categoryId);
        const txCurCode = CURRENCY_CODES[t.currency] || t.currency || 'TWD';
        return {
          id: t.id || 't-' + Date.now(),
          title: t.title || '',
          amount: Math.abs(parseFloat(t.amount)) || 0,
          categoryId: cat ? cat.id : 'cat-food',
          currency: txCurCode,
          date: t.date || getTodayDateTimeString(),
          user: t.user || ''
        };
      });
      changed = true;
    }
    
    // 解析並覆蓋還原設定檔 (自訂類別、自訂幣別、匯率等)
    if (data.settings && typeof data.settings === 'object' && Object.keys(data.settings).length > 0) {
      const ds = data.settings;
      if (ds.categories) state.categories = ds.categories;
      if (ds.currency) state.currency = ds.currency;
      if (ds.exchangeRates) state.exchangeRates = ds.exchangeRates;
      if (ds.theme) state.theme = ds.theme;
      if (ds.bgTheme) state.bgTheme = ds.bgTheme;
      if (ds.fontScale) state.fontScale = ds.fontScale;
      
      if (ds.currencySymbols) CURRENCY_SYMBOLS = ds.currencySymbols;
      if (ds.currencyChinese) CURRENCY_CHINESE = ds.currencyChinese;
      if (ds.currencyCodes) CURRENCY_CODES = ds.currencyCodes;
      changed = true;
    }
    
    if (changed) {
      saveState();
      populateCurrencyDropdowns();
      renderExchangeRates();
      renderDashboard();
      renderCharts();
      applyCustomization();
      console.log('自動雲端載入完成！');
    }
  })
  .catch(err => {
    console.error('背景自動載入失敗：', err);
  });
}

// 8.8 更新首頁/智慧記帳頁的目前記帳人顯示標籤
function updateCurrentUserLabel() {
  const label = document.getElementById('current-user-name-label');
  if (label) {
    label.innerText = state.userName || '預設記帳人';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // 套用主題與字體自訂
  applyCustomization();

  // 背景嘗試雲端自動同步載入最新資料
  silentCloudSync();

  // 監聽主題色切換
  document.querySelectorAll('.theme-dot').forEach(dot => {
    dot.addEventListener('click', (e) => {
      state.theme = e.target.getAttribute('data-theme');
      saveState();
      applyCustomization();
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
    });
  });

  // 監聽背景色切換
  document.querySelectorAll('.bg-theme-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      state.bgTheme = e.target.getAttribute('data-bg');
      saveState();
      applyCustomization();
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
    });
  });

  // 監聽字體大小滑桿
  const fontSlider = document.getElementById('font-scale-slider');
  if (fontSlider) {
    fontSlider.addEventListener('input', (e) => {
      state.fontScale = parseFloat(e.target.value);
      saveState();
      applyCustomization();
    });
  }

  // 載入與初始化記帳人設定
  const usernameInput = document.getElementById('username-input');
  if (usernameInput) {
    usernameInput.value = state.userName || '';
    usernameInput.addEventListener('input', (e) => {
      state.userName = e.target.value.trim() || '預設記帳人';
      saveState();
      updateCurrentUserLabel(); // 即時同步更新智慧記帳頁的記帳人標籤
    });
  }

  // 監聽記帳人篩選切換
  const userFilterSelect = document.getElementById('user-filter-select');
  if (userFilterSelect) {
    userFilterSelect.addEventListener('change', () => {
      renderDashboard();
      renderCharts(); // 重新繪製該記帳人的佔比圖
    });
  }

  renderDashboard();
  updateCurrentUserLabel(); // 初始化記帳人顯示標籤
  updateOnlineStatus();
  updateCategoryDropdown();
  
  // 載入與初始化幣別下拉選單
  populateCurrencyDropdowns();
  
  // 監聽幣別切換
  const curSelect = document.getElementById('currency-select');
  if (curSelect) {
    curSelect.addEventListener('change', (e) => {
      state.currency = e.target.value;
      saveState();
      renderDashboard();
    });
  }

  // 載入與渲染匯率欄位列表
  renderExchangeRates();

  // 監聽儲存匯率按鈕
  const saveRatesBtn = document.getElementById('btn-save-rates');
  if (saveRatesBtn) {
    saveRatesBtn.addEventListener('click', () => {
      const rateInputs = document.querySelectorAll('.rate-input-field');
      const newRates = { TWD: 1 };
      let isValid = true;
      
      rateInputs.forEach(input => {
        const code = input.getAttribute('data-code');
        const val = parseFloat(input.value);
        if (isNaN(val) || val <= 0) {
          isValid = false;
        } else {
          newRates[code] = val;
        }
      });
      
      if (!isValid) {
        alert('請輸入大於 0 的正確匯率數值！');
        return;
      }
      
      state.exchangeRates = newRates;
      saveState();
      
      if (navigator.vibrate) {
        navigator.vibrate(80);
      }
      
      alert('匯率儲存成功！已更新帳目折算金額。');
      renderDashboard();
    });
  }

  // 監聽新增自訂幣別按鈕
  const btnAddCustomCurrency = document.getElementById('btn-add-custom-currency');
  if (btnAddCustomCurrency) {
    btnAddCustomCurrency.addEventListener('click', () => {
      const codeInput = document.getElementById('new-currency-code');
      const nameInput = document.getElementById('new-currency-name');
      const symbolInput = document.getElementById('new-currency-symbol');
      const rateInput = document.getElementById('new-currency-rate');
      
      const code = codeInput.value.trim().toUpperCase();
      const name = nameInput.value.trim();
      const symbol = symbolInput.value.trim();
      const rate = parseFloat(rateInput.value);
      
      if (!code || code.length !== 3 || !/^[A-Z]{3}$/.test(code)) {
        alert('請輸入正確的大寫英文 3 碼幣別代碼！(例如: CAD)');
        return;
      }
      if (code === 'TWD') {
        alert('不能新增台幣 TWD，台幣為系統基準幣別。');
        return;
      }
      if (CURRENCY_CHINESE[code]) {
        alert(`幣別代碼 ${code} 已存在，無法重複新增！`);
        return;
      }
      if (!name) {
        alert('請輸入幣別中文名稱！(例如: 加幣)');
        return;
      }
      if (!symbol) {
        alert('請輸入貨幣符號！(例如: C$)');
        return;
      }
      if (isNaN(rate) || rate <= 0) {
        alert('請輸入大於 0 的對台幣匯率！');
        return;
      }
      
      // 更新全域對照表與狀態
      CURRENCY_SYMBOLS[code] = symbol;
      CURRENCY_CHINESE[code] = name;
      CURRENCY_CODES[name] = code;
      state.exchangeRates[code] = rate;
      
      saveState();
      
      // 清空輸入框
      codeInput.value = '';
      nameInput.value = '';
      symbolInput.value = '';
      rateInput.value = '';
      
      if (navigator.vibrate) {
        navigator.vibrate(80);
      }
      
      alert(`新增自訂幣別 ${name} (${code}) 成功！`);
      
      // 重新載入下拉選單與匯率設定欄位
      populateCurrencyDropdowns();
      renderExchangeRates();
      renderDashboard();
    });
  }

  // 載入與初始化 Google Apps Script 網址
  const gasUrlInput = document.getElementById('gas-url');
  if (gasUrlInput) {
    gasUrlInput.value = state.gasUrl || '';
    gasUrlInput.addEventListener('input', (e) => {
      state.gasUrl = e.target.value.trim();
      saveState();
    });
  }

  // 監聽備份至雲端按鈕
  const backupBtn = document.getElementById('btn-backup-sheets');
  if (backupBtn) {
    backupBtn.addEventListener('click', () => {
      if (!state.gasUrl) {
        alert('請先輸入 Google Apps Script 部署網址！');
        return;
      }
      
      backupBtn.disabled = true;
      backupBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 備份中...';
      
      // 轉換欄位為中文類別與中文幣別名稱進行備份，且支出金額加上負號
      const backupTransactions = state.transactions.map(t => {
        const cat = state.categories.find(c => c.id === t.categoryId);
        const txCur = t.currency || 'TWD';
        const isExpense = cat ? cat.type === 'expense' : true;
        const signedAmount = isExpense ? -Math.abs(t.amount) : Math.abs(t.amount);
        return {
          id: t.id,
          title: t.title,
          amount: signedAmount,
          categoryId: cat ? cat.name : '其他',
          currency: CURRENCY_CHINESE[txCur] || '新台幣',
          date: t.date || getTodayDateTimeString(),
          user: t.user || ''
        };
      });

      const payload = {
        transactions: backupTransactions,
        settings: {
          categories: state.categories,
          currency: state.currency,
          exchangeRates: state.exchangeRates,
          currencySymbols: CURRENCY_SYMBOLS,
          currencyChinese: CURRENCY_CHINESE,
          currencyCodes: CURRENCY_CODES,
          theme: state.theme,
          bgTheme: state.bgTheme,
          fontScale: state.fontScale
        }
      };
      
      fetch(state.gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          if (navigator.vibrate) {
            navigator.vibrate(80);
          }
          alert(`備份成功！已同步 ${data.count} 筆記帳明細與幣別設定至您的 Google 試算表。`);
        } else {
          alert(`備份失敗：${data.message || '未知錯誤'}`);
        }
      })
      .catch(err => {
        console.error(err);
        alert('備份出錯，請確認您的 Apps Script 網址是否正確並支援跨域存取！');
      })
      .finally(() => {
        backupBtn.disabled = false;
        backupBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> 備份至雲端';
      });
    });
  }

  // 監聽從雲端還原按鈕
  const restoreBtn = document.getElementById('btn-restore-sheets');
  if (restoreBtn) {
    restoreBtn.addEventListener('click', () => {
      if (!state.gasUrl) {
        alert('請先輸入 Google Apps Script 部署網址！');
        return;
      }
      
      if (confirm('警告：這將會使用雲端試算表上的資料「覆蓋還原」您本機的記帳明細與幣別設定。確定要還原嗎？')) {
        restoreBtn.disabled = true;
        restoreBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 還原中...';
        
        fetch(state.gasUrl, {
          method: 'GET',
          mode: 'cors'
        })
        .then(res => res.json())
        .then(data => {
          let txSource = [];
          let settingsSource = null;

          // 相容舊格式 (直接傳回陣列) 與新格式 (傳回 {transactions, settings})
          if (Array.isArray(data)) {
            txSource = data;
          } else if (data && typeof data === 'object') {
            txSource = data.transactions || [];
            settingsSource = data.settings;
          }

          // 還原明細
          state.transactions = txSource.map(t => {
            const cat = state.categories.find(c => c.name === t.categoryId) || state.categories.find(c => c.id === t.categoryId);
            const txCurCode = CURRENCY_CODES[t.currency] || t.currency || 'TWD';
            return {
              id: t.id || 't-' + Date.now(),
              title: t.title || '',
              amount: Math.abs(parseFloat(t.amount)) || 0,
              categoryId: cat ? cat.id : 'cat-food',
              currency: txCurCode,
              date: t.date || getTodayDateTimeString(),
              user: t.user || ''
            };
          });

          // 還原自訂類別與幣別設定
          if (settingsSource && typeof settingsSource === 'object' && Object.keys(settingsSource).length > 0) {
            if (settingsSource.categories) state.categories = settingsSource.categories;
            if (settingsSource.currency) state.currency = settingsSource.currency;
            if (settingsSource.exchangeRates) state.exchangeRates = settingsSource.exchangeRates;
            if (settingsSource.theme) state.theme = settingsSource.theme;
            if (settingsSource.bgTheme) state.bgTheme = settingsSource.bgTheme;
            if (settingsSource.fontScale) state.fontScale = settingsSource.fontScale;
            
            if (settingsSource.currencySymbols) CURRENCY_SYMBOLS = settingsSource.currencySymbols;
            if (settingsSource.currencyChinese) CURRENCY_CHINESE = settingsSource.currencyChinese;
            if (settingsSource.currencyCodes) CURRENCY_CODES = settingsSource.currencyCodes;
          }

          saveState();
          
          if (navigator.vibrate) {
            navigator.vibrate(80);
          }
          alert(`還原成功！已同步還原 ${state.transactions.length} 筆明細與自訂幣別設定。`);
          
          populateCurrencyDropdowns();
          renderExchangeRates();
          renderDashboard();
          renderCharts();
          applyCustomization();
        })
        .catch(err => {
          console.error(err);
          alert('還原出錯，請確認您的 Apps Script 網址是否正確，且試算表中已有資料！');
        })
        .finally(() => {
          restoreBtn.disabled = false;
          restoreBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-down"></i> 從雲端還原';
        });
      }
    });
  }

  // 8.1 區間查詢篩選控制面板
  const btnToggleFilter = document.getElementById('btn-toggle-filter');
  const filterInputs = document.getElementById('filter-inputs');
  const filterChevron = document.getElementById('filter-chevron');
  if (btnToggleFilter && filterInputs && filterChevron) {
    btnToggleFilter.addEventListener('click', () => {
      const isHidden = filterInputs.style.display === 'none' || filterInputs.style.display === '';
      filterInputs.style.display = isHidden ? 'flex' : 'none';
      filterChevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    });
  }

  const btnFilterApply = document.getElementById('btn-filter-apply');
  if (btnFilterApply) {
    btnFilterApply.addEventListener('click', () => {
      const startVal = document.getElementById('filter-start-date').value;
      const endVal = document.getElementById('filter-end-date').value;
      if (!startVal || !endVal) {
        alert('請選擇完整的開始與結束日期！');
        return;
      }
      if (startVal > endVal) {
         alert('開始日期不能晚於結束日期！');
         return;
      }
      state.queryStart = startVal;
      state.queryEnd = endVal;
      renderDashboard();
      renderCharts();
    });
  }

  const btnFilterReset = document.getElementById('btn-filter-reset');
  if (btnFilterReset) {
    btnFilterReset.addEventListener('click', () => {
      document.getElementById('filter-start-date').value = '';
      document.getElementById('filter-end-date').value = '';
      state.queryStart = null;
      state.queryEnd = null;
      renderDashboard();
      renderCharts();
    });
  }

  // 8.2 區間清除彈出視窗事件
  const clearModal = document.getElementById('clear-modal');
  const btnClearHistory = document.getElementById('btn-clear-history');
  const btnCloseClearModal = document.getElementById('btn-close-clear-modal');

  if (btnClearHistory && clearModal) {
    btnClearHistory.addEventListener('click', () => {
      clearModal.classList.add('active');
      let activeRangeText = '';
      let count = 0;
      if (state.queryStart && state.queryEnd) {
        activeRangeText = `${state.queryStart} ~ ${state.queryEnd}`;
        count = state.transactions.filter(t => {
          const tDateStr = t.date ? t.date.split(' ')[0] : '';
          return tDateStr >= state.queryStart && tDateStr <= state.queryEnd;
        }).length;
      } else {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        activeRangeText = `${currentYear}年${currentMonth + 1}月`;
        count = state.transactions.filter(t => {
          const tDate = new Date(t.date);
          return tDate.getFullYear() === currentYear && tDate.getMonth() === currentMonth;
        }).length;
      }
      document.getElementById('clear-range-desc').innerText = `${activeRangeText} 的 ${count} 筆帳目`;
    });
  }

  if (btnCloseClearModal && clearModal) {
    btnCloseClearModal.addEventListener('click', () => {
      clearModal.classList.remove('active');
    });
  }

  const btnClearRange = document.getElementById('btn-clear-range');
  if (btnClearRange) {
    btnClearRange.addEventListener('click', () => {
      if (confirm('確定要清除此區間的所有記帳記錄嗎？此動作無法復原。')) {
        if (state.queryStart && state.queryEnd) {
          state.transactions = state.transactions.filter(t => {
            const tDateStr = t.date ? t.date.split(' ')[0] : '';
            return tDateStr < state.queryStart || tDateStr > state.queryEnd;
          });
        } else {
          const now = new Date();
          const currentYear = now.getFullYear();
          const currentMonth = now.getMonth();
          state.transactions = state.transactions.filter(t => {
            const tDate = new Date(t.date);
            return !(tDate.getFullYear() === currentYear && tDate.getMonth() === currentMonth);
          });
        }
        saveState();
        renderDashboard();
        renderCharts();
        clearModal.classList.remove('active');
        alert('清除成功！');
      }
    });
  }

  const btnClearCustom = document.getElementById('btn-clear-custom');
  if (btnClearCustom) {
    btnClearCustom.addEventListener('click', () => {
      const startVal = document.getElementById('clear-start-date').value;
      const endVal = document.getElementById('clear-end-date').value;
      if (!startVal || !endVal) {
        alert('請選擇要清除的開始與結束日期！');
        return;
      }
      if (startVal > endVal) {
        alert('開始日期不能晚於結束日期！');
        return;
      }
      
      const count = state.transactions.filter(t => {
        const tDateStr = t.date ? t.date.split(' ')[0] : '';
        return tDateStr >= startVal && tDateStr <= endVal;
      }).length;
      
      if (confirm(`確定要清除自訂區間 (${startVal} ~ ${endVal}) 的 ${count} 筆帳目嗎？此動作無法復原。`)) {
        state.transactions = state.transactions.filter(t => {
          const tDateStr = t.date ? t.date.split(' ')[0] : '';
          return tDateStr < startVal || tDateStr > endVal;
        });
        saveState();
        renderDashboard();
        renderCharts();
        clearModal.classList.remove('active');
        alert('清除成功！');
      }
    });
  }

  const btnClearAll = document.getElementById('btn-clear-all');
  if (btnClearAll) {
    btnClearAll.addEventListener('click', () => {
      if (confirm('警告：確定要清空所有歷史資料嗎？這將刪除所有月份的記帳記錄且無法復原！')) {
        state.transactions = [];
        saveState();
        renderDashboard();
        renderCharts();
        clearModal.classList.remove('active');
        alert('已清空所有歷史資料！');
      }
    });
  }

  // 8.5 備份字串匯出與匯入轉移功能
  const btnExportBackup = document.getElementById('btn-export-backup');
  const btnImportBackup = document.getElementById('btn-import-backup');
  const backupTextArea = document.getElementById('backup-text-area');

  if (btnExportBackup && backupTextArea) {
    btnExportBackup.addEventListener('click', () => {
      const backupData = {
        transactions: state.transactions,
        categories: state.categories,
        currency: state.currency,
        exchangeRates: state.exchangeRates,
        currencySymbols: CURRENCY_SYMBOLS,
        currencyChinese: CURRENCY_CHINESE,
        currencyCodes: CURRENCY_CODES,
        gasUrl: state.gasUrl,
        theme: state.theme,
        bgTheme: state.bgTheme,
        fontScale: state.fontScale
      };
      
      try {
        // 使用 Base64 編碼，避免純文字 JSON 被截斷且不易複製
        const jsonStr = JSON.stringify(backupData);
        const base64Str = btoa(unescape(encodeURIComponent(jsonStr)));
        backupTextArea.value = base64Str;
        
        // 自動選擇並複製到剪貼簿
        backupTextArea.select();
        document.execCommand('copy');
        
        if (navigator.vibrate) {
          navigator.vibrate(80);
        }
        alert('備份字串產生成功，已自動複製到您的剪貼簿！請將該字串傳送至其他裝置匯入。');
      } catch (err) {
        console.error(err);
        alert('產生備份字串失敗！');
      }
    });
  }

  if (btnImportBackup && backupTextArea) {
    btnImportBackup.addEventListener('click', () => {
      const rawText = backupTextArea.value.trim();
      if (!rawText) {
        alert('請先在輸入框貼上要匯入的備份字串！');
        return;
      }
      
      if (confirm('警告：匯入備份資料將會完全「覆蓋取代」您目前這台裝置上的所有記帳紀錄與設定！確定要執行嗎？')) {
        try {
          // 解碼 Base64
          const jsonStr = decodeURIComponent(escape(atob(rawText)));
          const data = JSON.parse(jsonStr);
          
          if (!data || typeof data !== 'object') {
            throw new Error('格式錯誤');
          }
          
          // 還原並覆蓋 state 與全域變數
          if (data.transactions) state.transactions = data.transactions;
          if (data.categories) state.categories = data.categories;
          if (data.currency) state.currency = data.currency;
          if (data.exchangeRates) state.exchangeRates = data.exchangeRates;
          if (data.gasUrl !== undefined) state.gasUrl = data.gasUrl;
          if (data.theme) state.theme = data.theme;
          if (data.bgTheme) state.bgTheme = data.bgTheme;
          if (data.fontScale) state.fontScale = data.fontScale;
          
          if (data.currencySymbols) CURRENCY_SYMBOLS = data.currencySymbols;
          if (data.currencyChinese) CURRENCY_CHINESE = data.currencyChinese;
          if (data.currencyCodes) CURRENCY_CODES = data.currencyCodes;
          
          saveState();
          
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }
          
          alert('資料匯入還原成功！網頁即將自動重新整理以套用新設定。');
          location.reload();
        } catch (err) {
          console.error(err);
          alert('匯入失敗：備份字串無效或損毀，請確認是否複製完整！');
        }
      }
    });
  }
});
