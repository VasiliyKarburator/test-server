// ====== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ======
let tg = window.Telegram.WebApp;
let botToken = '8404025332:AAH0lKtgBsLfsG_R0CbcG3MhHJ83EzASHCg';
let apiBase = 'http://localhost:5000/api'; // Или ваш сервер

let currentUser = null;
let currentTheme = 'dark';
let charts = {};
let dataCache = {};
let autoRefreshInterval = null;
let selectedUsers = new Set();

// ====== ИНИЦИАЛИЗАЦИЯ ======
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Инициализация админ-панели...');
    
    // Инициализация темы
    initTheme();
    
    // Запускаем анимацию загрузки
    simulateLoading();
    
    // Инициализация Telegram Web App
    if (tg.initDataUnsafe) {
        await initTelegramApp();
    } else {
        // Если не в Telegram, используем параметры URL
        await initStandalone();
    }
    
    // Инициализация системы
    await initSystem();
    
    // Запускаем автообновление
    startAutoRefresh();
    
    console.log('✅ Админ-панель инициализирована');
});

// ====== ТЕМА ОФОРМЛЕНИЯ ======
function initTheme() {
    // Загружаем сохраненную тему
    const savedTheme = localStorage.getItem('adminTheme') || 'dark';
    currentTheme = savedTheme;
    
    // Применяем тему
    document.body.setAttribute('data-theme', currentTheme);
    document.querySelectorAll(`[data-theme="${currentTheme}"]`).forEach(btn => {
        btn.classList.add('active');
    });
    
    // Назначаем обработчики переключателей темы
    document.querySelectorAll('.theme-btn, .theme-option').forEach(btn => {
        btn.addEventListener('click', function() {
            const theme = this.getAttribute('data-theme');
            if (theme) {
                changeTheme(theme);
            }
        });
    });
}

function changeTheme(theme) {
    currentTheme = theme;
    
    // Сохраняем в localStorage
    localStorage.setItem('adminTheme', theme);
    
    // Обновляем атрибут body
    document.body.setAttribute('data-theme', theme);
    
    // Обновляем активные кнопки
    document.querySelectorAll('.theme-btn, .theme-option').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-theme') === theme) {
            btn.classList.add('active');
        }
    });
    
    // Перерисовываем графики
    if (charts.revenueChart) {
        setTimeout(() => {
            updateChartColors(charts.revenueChart);
            charts.revenueChart.update();
        }, 100);
    }
    
    if (charts.usersChart) {
        setTimeout(() => {
            updateChartColors(charts.usersChart);
            charts.usersChart.update();
        }, 100);
    }
    
    showNotification(`Тема изменена на "${getThemeName(theme)}"`, 'success');
}

function getThemeName(theme) {
    const names = {
        'light': 'Светлая',
        'dark': 'Темная', 
        'space': 'Космическая'
    };
    return names[theme] || theme;
}

// ====== TELEGRAM ИНИЦИАЛИЗАЦИЯ ======
async function initTelegramApp() {
    try {
        tg.expand();
        tg.enableClosingConfirmation();
        
        const initData = tg.initDataUnsafe;
        if (initData.user) {
            currentUser = {
                id: initData.user.id,
                firstName: initData.user.first_name,
                lastName: initData.user.last_name || '',
                username: initData.user.username || '',
                languageCode: initData.user.language_code || 'ru'
            };
            
            updateUserUI();
            
            // Проверяем права админа
            const isAdmin = await checkAdminStatus(currentUser.id);
            if (!isAdmin) {
                showNotification('У вас нет прав доступа к админ-панели!', 'error');
                setTimeout(() => tg.close(), 2000);
                return false;
            }
            
            return true;
        }
    } catch (error) {
        console.error('Ошибка инициализации Telegram:', error);
        showNotification('Ошибка подключения к Telegram', 'error');
    }
    
    return false;
}

async function initStandalone() {
    // Для standalone режима (не в Telegram)
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user_id');
    
    if (!userId) {
        showNotification('Требуется user_id параметр', 'error');
        return false;
    }
    
    currentUser = {
        id: parseInt(userId),
        firstName: 'Администратор',
        lastName: '',
        username: 'admin',
        languageCode: 'ru'
    };
    
    updateUserUI();
    
    // Проверяем права админа через API
    const isAdmin = await checkAdminStatus(currentUser.id);
    if (!isAdmin) {
        showNotification('У вас нет прав доступа к админ-панели!', 'error');
        return false;
    }
    
    return true;
}

// ====== СИСТЕМА ======
async function initSystem() {
    try {
        // Проверяем здоровье API
        const health = await fetchData('/health');
        if (!health) {
            throw new Error('API недоступен');
        }
        
        // Обновляем статус подключения
        updateConnectionStatus(true);
        
        // Загружаем начальные данные
        await loadInitialData();
        
        // Инициализируем графики
        initCharts();
        
        // Показываем основное приложение
        document.getElementById('loader').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loader').style.display = 'none';
            document.getElementById('app').classList.remove('hidden');
        }, 300);
        
    } catch (error) {
        console.error('Ошибка инициализации системы:', error);
        updateConnectionStatus(false);
        showNotification('Ошибка подключения к серверу', 'error');
        
        // Показываем экран ошибки
        document.getElementById('progressText').textContent = 'Ошибка подключения';
        document.getElementById('progressFill').style.width = '0%';
    }
}

function simulateLoading() {
    let progress = 0;
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    const steps = [
        {text: 'Инициализация системы...', percent: 20},
        {text: 'Подключение к базе данных...', percent: 40},
        {text: 'Загрузка конфигурации...', percent: 60},
        {text: 'Проверка подключений...', percent: 80},
        {text: 'Загрузка интерфейса...', percent: 100}
    ];
    
    steps.forEach((step, index) => {
        setTimeout(() => {
            progressFill.style.width = step.percent + '%';
            progressText.textContent = step.text;
        }, index * 500);
    });
}

// ====== API ФУНКЦИИ ======
async function fetchData(endpoint, options = {}) {
    const url = `${apiBase}${endpoint}`;
    
    const headers = {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (currentUser) {
        const params = new URLSearchParams(options.params || {});
        params.set('user_id', currentUser.id);
        
        const fullUrl = `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`;
        
        try {
            const response = await fetch(fullUrl, {
                ...options,
                headers
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`Ошибка запроса ${endpoint}:`, error);
            throw error;
        }
    }
    
    return null;
}

async function postData(endpoint, data = {}) {
    return fetchData(endpoint, {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

// ====== ПРОВЕРКА АДМИНА ======
async function checkAdminStatus(userId) {
    try {
        const response = await fetch(`${apiBase}/check-admin/${userId}`);
        const data = await response.json();
        return data.is_admin === true;
    } catch (error) {
        console.error('Ошибка проверки админа:', error);
        return false;
    }
}

// ====== ОБНОВЛЕНИЕ UI ======
function updateUserUI() {
    if (!currentUser) return;
    
    document.getElementById('username').textContent = 
        currentUser.firstName + (currentUser.lastName ? ' ' + currentUser.lastName : '');
    document.getElementById('userId').textContent = `ID: ${currentUser.id}`;
    
    // Пытаемся загрузить аватар
    loadUserAvatar(currentUser.id);
}

async function loadUserAvatar(userId) {
    try {
        // Здесь можно добавить загрузку аватара через Telegram API
        // Пока используем дефолтный аватар
        const avatar = document.getElementById('userAvatar');
        avatar.innerHTML = `<i class="fas fa-user"></i>`;
    } catch (error) {
        console.error('Ошибка загрузки аватара:', error);
    }
}

function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connectionStatus');
    if (connected) {
        statusEl.innerHTML = '<i class="fas fa-circle"></i><span>Подключено</span>';
        statusEl.classList.add('connected');
    } else {
        statusEl.innerHTML = '<i class="fas fa-circle"></i><span>Отключено</span>';
        statusEl.classList.remove('connected');
    }
}

// ====== ЗАГРУЗКА ДАННЫХ ======
async function loadInitialData() {
    try {
        // Параллельная загрузка всех данных
        const [stats, users, payments] = await Promise.all([
            fetchData('/stats'),
            fetchData('/users?limit=10'),
            fetchData('/payments?limit=10')
        ]);
        
        // Обновляем дашборд
        updateDashboard(stats);
        
        // Обновляем таблицы
        updateUsersTable(users?.users || []);
        updatePaymentsTable(payments?.payments || []);
        
        // Обновляем счетчики
        updateCounters(stats, users, payments);
        
        // Обновляем время
        updateLastUpdateTime();
        
        // Загружаем активность
        loadActivity();
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        throw error;
    }
}

function updateDashboard(stats) {
    if (!stats || !stats.stats) return;
    
    const s = stats.stats;
    
    document.getElementById('totalUsers').textContent = s.total_users || 0;
    document.getElementById('activeUsers').textContent = s.active_users || 0;
    document.getElementById('todayRevenue').textContent = `$${s.today_income || 0}`;
    document.getElementById('totalRevenue').textContent = `$${s.total_income || 0}`;
    document.getElementById('totalCampaigns').textContent = s.total_campaigns || 0;
    document.getElementById('totalEmails').textContent = s.total_emails || 0;
    document.getElementById('activeAccounts').textContent = s.active_accounts || 0;
    document.getElementById('totalIncome').textContent = `$${s.total_income || 0}`;
    
    // Обновляем графики
    updateChartsData(s);
}

function updateCounters(stats, users, payments) {
    if (stats?.stats) {
        document.getElementById('usersCount').textContent = stats.stats.total_users || 0;
        document.getElementById('paymentsCount').textContent = payments?.stats?.completed_count || 0;
    }
    
    // Обновляем статус системы
    updateSystemStatus();
}

function updateLastUpdateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    document.getElementById('lastUpdate').textContent = `Обновлено: ${timeString}`;
    document.getElementById('lastSystemActivity').textContent = timeString;
}

// ====== ГРАФИКИ ======
function initCharts() {
    const revenueCtx = document.getElementById('revenueChart').getContext('2d');
    const usersCtx = document.getElementById('usersChart').getContext('2d');
    
    // График доходов
    charts.revenueChart = new Chart(revenueCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Доход ($)',
                data: [],
                borderColor: getChartColor('primary'),
                backgroundColor: getChartColor('primary', 0.1),
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: getChartColor('primary'),
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: getChartOptions('Доход по дням ($)')
    });
    
    // График пользователей
    charts.usersChart = new Chart(usersCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Новые пользователи',
                data: [],
                backgroundColor: getChartColor('secondary', 0.8),
                borderColor: getChartColor('secondary'),
                borderWidth: 1,
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: getChartOptions('Новые пользователи')
    });
}

function getChartColor(type, alpha = 1) {
    const colors = {
        'light': {
            'primary': `rgba(79, 70, 229, ${alpha})`,
            'secondary': `rgba(124, 58, 237, ${alpha})`
        },
        'dark': {
            'primary': `rgba(99, 102, 241, ${alpha})`,
            'secondary': `rgba(139, 92, 246, ${alpha})`
        },
        'space': {
            'primary': `rgba(139, 92, 246, ${alpha})`,
            'secondary': `rgba(236, 72, 153, ${alpha})`
        }
    };
    
    return colors[currentTheme]?.[type] || colors.dark.primary;
}

function getChartOptions(title) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                backgroundColor: getComputedStyle(document.body).getPropertyValue('--bg-card'),
                titleColor: getComputedStyle(document.body).getPropertyValue('--text-primary'),
                bodyColor: getComputedStyle(document.body).getPropertyValue('--text-secondary'),
                borderColor: getComputedStyle(document.body).getPropertyValue('--border-color'),
                borderWidth: 1,
                cornerRadius: 6,
                displayColors: false
            }
        },
        scales: {
            x: {
                grid: {
                    color: getComputedStyle(document.body).getPropertyValue('--border-color')
                },
                ticks: {
                    color: getComputedStyle(document.body).getPropertyValue('--text-secondary')
                }
            },
            y: {
                grid: {
                    color: getComputedStyle(document.body).getPropertyValue('--border-color')
                },
                ticks: {
                    color: getComputedStyle(document.body).getPropertyValue('--text-secondary')
                }
            }
        }
    };
}

function updateChartColors(chart) {
    if (chart.data.datasets[0]) {
        chart.data.datasets[0].borderColor = getChartColor('primary');
        chart.data.datasets[0].backgroundColor = getChartColor('primary', 0.1);
        chart.data.datasets[0].pointBackgroundColor = getChartColor('primary');
    }
    chart.update();
}

function updateChartsData(stats) {
    // Здесь можно добавить реальные данные для графиков
    // Пока используем тестовые данные
    const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    
    if (charts.revenueChart) {
        charts.revenueChart.data.labels = days;
        charts.revenueChart.data.datasets[0].data = [120, 190, 300, 500, 200, 300, 450];
        charts.revenueChart.update();
    }
    
    if (charts.usersChart) {
        charts.usersChart.data.labels = days;
        charts.usersChart.data.datasets[0].data = [12, 19, 8, 15, 22, 18, 25];
        charts.usersChart.update();
    }
}

// ====== ТАБЛИЦЫ ======
function updateUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    if (!users || users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-8">
                    <div class="empty-state">
                        <i class="fas fa-users"></i>
                        <p>Нет пользователей</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    users.forEach(user => {
        const subscriptionBadge = user.subscription_days > 0 
            ? `<span class="status-badge status-success">${user.subscription_days} дней</span>`
            : `<span class="status-badge status-failed">Нет подписки</span>`;
        
        const adminBadge = user.is_admin 
            ? '<span class="badge">👑 АДМИН</span>' 
            : '';
        
        html += `
            <tr data-user-id="${user.user_id}" onclick="selectUserRow(this, ${user.user_id})">
                <td>
                    <input type="checkbox" onchange="toggleUserSelection(${user.user_id}, this.checked)">
                </td>
                <td>${user.user_id}</td>
                <td>
                    <div class="flex items-center gap-3">
                        <div class="avatar-small">
                            <i class="fas fa-user"></i>
                        </div>
                        <div>
                            <div class="font-medium">${user.first_name} ${user.last_name || ''}</div>
                            <div class="text-sm text-muted">@${user.username || 'нет'}</div>
                        </div>
                        ${adminBadge}
                    </div>
                </td>
                <td>${subscriptionBadge}</td>
                <td>$${user.total_spent || 0}</td>
                <td>${formatDate(user.registration_date)}</td>
                <td>
                    <div class="flex gap-2">
                        <button class="btn-small" onclick="editUser(${user.user_id}, event)">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-small btn-danger" onclick="deleteUser(${user.user_id}, event)">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    updateSelectedCount();
}

function updatePaymentsTable(payments) {
    const tbody = document.getElementById('paymentsTableBody');
    if (!tbody) return;
    
    if (!payments || payments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-8">
                    <div class="empty-state">
                        <i class="fas fa-credit-card"></i>
                        <p>Нет платежей</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    payments.forEach(payment => {
        const statusClass = payment.status === 'completed' ? 'status-success' :
                          payment.status === 'pending' ? 'status-pending' : 'status-failed';
        
        const statusText = payment.status === 'completed' ? '✅ Завершен' :
                         payment.status === 'pending' ? '⏳ Ожидание' : '❌ Ошибка';
        
        html += `
            <tr>
                <td>${payment.id}</td>
                <td>
                    <div class="font-medium">${payment.first_name || ''} ${payment.last_name || ''}</div>
                    <div class="text-sm text-muted">ID: ${payment.user_id}</div>
                </td>
                <td>${payment.days}</td>
                <td class="font-semibold">$${payment.amount}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td><code class="text-xs">${payment.invoice_id || 'N/A'}</code></td>
                <td>${formatDate(payment.date)}</td>
                <td>
                    <button class="btn-small" onclick="viewPayment(${payment.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// ====== УТИЛИТЫ ======
function formatDate(dateString) {
    if (!dateString) return '—';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatDateTime(dateString) {
    if (!dateString) return '—';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ====== УВЕДОМЛЕНИЯ ======
function showNotification(message, type = 'info', duration = 5000) {
    const container = document.getElementById('notificationContainer');
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-times-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    notification.innerHTML = `
        <div class="notification-icon">
            <i class="${icons[type] || icons.info}"></i>
        </div>
        <div class="notification-message">${message}</div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(notification);
    
    // Автоматическое удаление
    if (duration > 0) {
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, duration);
    }
    
    // Анимация
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
        notification.style.opacity = '1';
    }, 10);
}

// ====== СЕКЦИИ ======
function showSection(sectionId) {
    // Скрываем все секции
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Показываем нужную секцию
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Обновляем активный пункт меню
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const navItem = document.querySelector(`[onclick="showSection('${sectionId}')"]`);
    if (navItem) {
        navItem.classList.add('active');
    }
    
    // Загружаем данные для секции если нужно
    loadSectionData(sectionId);
}

async function loadSectionData(sectionId) {
    try {
        switch(sectionId) {
            case 'dashboard':
                await loadDashboard();
                break;
            case 'users':
                await loadUsers();
                break;
            case 'payments':
                await loadPayments();
                break;
            case 'templates':
                await loadTemplates();
                break;
            case 'accounts':
                await loadAccounts();
                break;
            case 'campaigns':
                await loadCampaigns();
                break;
        }
    } catch (error) {
        console.error(`Ошибка загрузки секции ${sectionId}:`, error);
        showNotification('Ошибка загрузки данных', 'error');
    }
}

// ====== ЗАГРУЗКА ДАННЫХ СЕКЦИЙ ======
async function loadDashboard() {
    try {
        const stats = await fetchData('/stats');
        if (stats) {
            updateDashboard(stats);
            updateLastUpdateTime();
            showNotification('Дашборд обновлен', 'success');
        }
    } catch (error) {
        console.error('Ошибка загрузки дашборда:', error);
        throw error;
    }
}

async function loadUsers(page = 1) {
    try {
        const users = await fetchData(`/users?page=${page}&limit=20`);
        if (users) {
            updateUsersTable(users.users);
            updateUsersPagination(users.pagination);
        }
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        throw error;
    }
}

async function loadPayments(page = 1) {
    try {
        const payments = await fetchData(`/payments?page=${page}&limit=20`);
        if (payments) {
            updatePaymentsTable(payments.payments);
            updatePaymentsStats(payments.stats);
            updatePaymentsPagination(payments.pagination);
        }
    } catch (error) {
        console.error('Ошибка загрузки платежей:', error);
        throw error;
    }
}

async function loadTemplates() {
    try {
        const templates = await fetchData('/templates');
        updateTemplatesGrid(templates || []);
    } catch (error) {
        console.error('Ошибка загрузки шаблонов:', error);
        throw error;
    }
}

async function loadAccounts() {
    try {
        const accounts = await fetchData('/accounts');
        updateAccountsList(accounts || []);
    } catch (error) {
        console.error('Ошибка загрузки аккаунтов:', error);
        throw error;
    }
}

async function loadCampaigns() {
    try {
        const campaigns = await fetchData('/campaigns');
        updateCampaignsTable(campaigns || []);
    } catch (error) {
        console.error('Ошибка загрузки рассылок:', error);
        throw error;
    }
}

// ====== АВТООБНОВЛЕНИЕ ======
function startAutoRefresh() {
    const toggle = document.getElementById('autoRefreshToggle');
    if (!toggle) return;
    
    // Загружаем настройки
    const autoRefreshEnabled = localStorage.getItem('autoRefresh') !== 'false';
    toggle.checked = autoRefreshEnabled;
    
    if (autoRefreshEnabled) {
        autoRefreshInterval = setInterval(() => {
            refreshCurrentSection();
        }, 30000); // 30 секунд
    }
    
    // Обработчик изменения
    toggle.addEventListener('change', function() {
        localStorage.setItem('autoRefresh', this.checked);
        
        if (this.checked) {
            autoRefreshInterval = setInterval(() => {
                refreshCurrentSection();
            }, 30000);
            showNotification('Автообновление включено', 'success');
        } else {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
            showNotification('Автообновление выключено', 'info');
        }
    });
}

function refreshCurrentSection() {
    const activeSection = document.querySelector('.section.active');
    if (!activeSection) return;
    
    const sectionId = activeSection.id;
    loadSectionData(sectionId);
}

// ====== МОДАЛЬНЫЕ ОКНА ======
function showModal(modalId) {
    document.getElementById('modalOverlay').style.display = 'block';
    document.getElementById(modalId).style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
    document.getElementById('modalOverlay').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// ====== ШАБЛОНЫ ======
function showCreateTemplateModal() {
    document.getElementById('templateName').value = '';
    document.getElementById('templateSubject').value = '';
    document.getElementById('templateText').value = '';
    showModal('createTemplateModal');
}

async function createTemplate() {
    const name = document.getElementById('templateName').value.trim();
    const subject = document.getElementById('templateSubject').value.trim();
    const text = document.getElementById('templateText').value.trim();
    
    if (!name || !subject || !text) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    try {
        const result = await postData('/templates', {
            name,
            subject,
            text,
            created_by: currentUser.id
        });
        
        if (result.success) {
            showNotification('Шаблон создан успешно', 'success');
            closeModal();
            await loadTemplates();
        } else {
            throw new Error(result.error || 'Ошибка создания шаблона');
        }
    } catch (error) {
        console.error('Ошибка создания шаблона:', error);
        showNotification('Ошибка создания шаблона', 'error');
    }
}

function insertVariable(variable) {
    const textarea = document.getElementById('templateText');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    textarea.value = textarea.value.substring(0, start) + 
                    variable + 
                    textarea.value.substring(end);
    
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + variable.length;
}

// ====== АККАУНТЫ ======
function showAddAccountModal() {
    showModal('addAccountModal');
}

async function addAccount() {
    const email = document.getElementById('accountEmail').value.trim();
    const password = document.getElementById('accountPassword').value.trim();
    const limit = document.getElementById('accountLimit').value;
    
    if (!email || !password) {
        showNotification('Заполните обязательные поля', 'error');
        return;
    }
    
    try {
        const result = await postData('/accounts', {
            email,
            password,
            daily_limit: parseInt(limit) || 100
        });
        
        if (result.success) {
            showNotification('Аккаунт добавлен', 'success');
            closeModal();
            await loadAccounts();
        } else {
            throw new Error(result.error || 'Ошибка добавления аккаунта');
        }
    } catch (error) {
        console.error('Ошибка добавления аккаунта:', error);
        showNotification('Ошибка добавления аккаунта', 'error');
    }
}

// ====== ПОЛЬЗОВАТЕЛИ ======
function toggleSelectAllUsers() {
    const checkbox = document.getElementById('selectAllUsers');
    const checkboxes = document.querySelectorAll('#usersTableBody input[type="checkbox"]');
    
    checkboxes.forEach(cb => {
        cb.checked = checkbox.checked;
        const userId = parseInt(cb.closest('tr').getAttribute('data-user-id'));
        if (checkbox.checked) {
            selectedUsers.add(userId);
        } else {
            selectedUsers.delete(userId);
        }
    });
    
    updateSelectedCount();
}

function toggleUserSelection(userId, checked) {
    if (checked) {
        selectedUsers.add(userId);
    } else {
        selectedUsers.delete(userId);
    }
    
    updateSelectedCount();
}

function selectUserRow(row, userId) {
    // Только если клик не на checkbox или кнопке
    if (!event.target.closest('input[type="checkbox"]') && 
        !event.target.closest('button')) {
        const checkbox = row.querySelector('input[type="checkbox"]');
        checkbox.checked = !checkbox.checked;
        toggleUserSelection(userId, checkbox.checked);
    }
}

function updateSelectedCount() {
    const count = selectedUsers.size;
    document.getElementById('selectedCount').textContent = `Выбрано: ${count}`;
}

function addDaysToUser() {
    if (selectedUsers.size === 0) {
        showNotification('Выберите пользователей', 'warning');
        return;
    }
    
    // Показываем модалку для добавления дней
    // Здесь можно реализовать логику для нескольких пользователей
    showModal('addDaysModal');
}

// ====== СИСТЕМНЫЕ ФУНКЦИИ ======
function logout() {
    if (tg.platform !== 'unknown') {
        tg.close();
    } else {
        if (confirm('Выйти из админ-панели?')) {
            window.location.href = '/';
        }
    }
}

function clearCache() {
    localStorage.clear();
    sessionStorage.clear();
    showNotification('Кэш очищен', 'success');
    setTimeout(() => {
        window.location.reload();
    }, 1000);
}

function backupDatabase() {
    showNotification('Функция бэкапа в разработке', 'info');
}

function exportDashboard() {
    showNotification('Экспорт отчета в разработке', 'info');
}

function exportUsers() {
    showNotification('Экспорт пользователей в разработке', 'info');
}

function exportPayments() {
    showNotification('Экспорт платежей в разработке', 'info');
}

function exportLogs() {
    showNotification('Экспорт логов в разработке', 'info');
}

function saveBotSettings() {
    showNotification('Настройки сохранены', 'success');
}

function updateSystemStatus() {
    // Обновляем статусы в настройках
    document.getElementById('dbStatus').textContent = '✅ Активна';
    document.getElementById('cryptoBotStatus').textContent = '✅ Подключен';
    document.getElementById('apiStatus').textContent = '✅ Работает';
}

function loadActivity() {
    // Загружаем активность (можно добавить реальные данные)
    const activityList = document.getElementById('activityList');
    
    const activities = [
        {type: 'success', icon: 'fa-user-plus', title: 'Новый пользователь', desc: 'Зарегистрировался user123', time: '2 мин назад'},
        {type: 'success', icon: 'fa-credit-card', title: 'Оплата', desc: 'Пользователь ID: 123456 оплатил подписку', time: '10 мин назад'},
        {type: 'info', icon: 'fa-paper-plane', title: 'Рассылка', desc: 'Запущена рассылка на 100 email', time: '30 мин назад'},
        {type: 'error', icon: 'fa-exclamation-triangle', title: 'Ошибка', desc: 'Проблема с email аккаунтом gmail@...', time: '1 час назад'}
    ];
    
    let html = '';
    activities.forEach(activity => {
        html += `
            <div class="activity-item ${activity.type}">
                <div class="activity-icon">
                    <i class="fas ${activity.icon}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">${activity.title}</div>
                    <div class="activity-desc">${activity.desc}</div>
                </div>
                <div class="activity-time">${activity.time}</div>
            </div>
        `;
    });
    
    activityList.innerHTML = html;
}

// ====== КОНТЕКСТНОЕ МЕНЮ ======
document.addEventListener('contextmenu', function(e) {
    if (e.target.closest('.data-table tr')) {
        e.preventDefault();
        showContextMenu(e);
    }
});

document.addEventListener('click', function() {
    hideContextMenu();
});

function showContextMenu(e) {
    const menu = document.getElementById('contextMenu');
    menu.style.display = 'block';
    menu.style.left = e.pageX + 'px';
    menu.style.top = e.pageY + 'px';
}

function hideContextMenu() {
    document.getElementById('contextMenu').style.display = 'none';
}

// ====== ПАГИНАЦИЯ ======
function updateUsersPagination(pagination) {
    const container = document.getElementById('usersPagination');
    if (!container || !pagination) return;
    
    let html = '';
    const { page, pages } = pagination;
    
    // Кнопка "Назад"
    html += `<button class="page-btn ${page === 1 ? 'disabled' : ''}" 
              onclick="${page > 1 ? `loadUsers(${page - 1})` : ''}">
              <i class="fas fa-chevron-left"></i>
            </button>`;
    
    // Страницы
    for (let i = 1; i <= Math.min(pages, 5); i++) {
        html += `<button class="page-btn ${i === page ? 'active' : ''}" 
                  onclick="loadUsers(${i})">${i}</button>`;
    }
    
    // Многоточие если страниц больше 5
    if (pages > 5) {
        html += `<span class="mx-2">...</span>`;
        html += `<button class="page-btn" onclick="loadUsers(${pages})">${pages}</button>`;
    }
    
    // Кнопка "Вперед"
    html += `<button class="page-btn ${page === pages ? 'disabled' : ''}" 
              onclick="${page < pages ? `loadUsers(${page + 1})` : ''}">
              <i class="fas fa-chevron-right"></i>
            </button>`;
    
    container.innerHTML = html;
}

// ====== ОБРАБОТЧИКИ СОБЫТИЙ ======
window.onload = function() {
    // Инициализация переключателей анимаций
    const animationsToggle = document.getElementById('animationsToggle');
    if (animationsToggle) {
        const animationsEnabled = localStorage.getItem('animations') !== 'false';
        animationsToggle.checked = animationsEnabled;
        
        animationsToggle.addEventListener('change', function() {
            localStorage.setItem('animations', this.checked);
            showNotification(
                this.checked ? 'Анимации включены' : 'Анимации выключены',
                'info'
            );
        });
    }
    
    // Обновление времени сервера
    updateServerTime();
    setInterval(updateServerTime, 60000);
};

function updateServerTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    });
    document.getElementById('serverTime').textContent = timeString;
}

// ====== ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ======
function searchUsers() {
    const search = document.getElementById('userSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#usersTableBody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(search) ? '' : 'none';
    });
}

function clearSearch() {
    document.getElementById('userSearch').value = '';
    searchUsers();
}

function filterUsers() {
    // Реализация фильтрации
    showNotification('Фильтр применен', 'info');
}

function sortUsers() {
    // Реализация сортировки
    showNotification('Сортировка применена', 'info');
}

function filterPayments() {
    // Реализация фильтрации платежей
    showNotification('Фильтр платежей применен', 'info');
}

function resetPaymentFilter() {
    document.getElementById('paymentDateFrom').value = '';
    document.getElementById('paymentDateTo').value = '';
    showNotification('Фильтр сброшен', 'info');
}

// ====== ЭКСПОРТ ФУНКЦИЙ В ГЛОБАЛЬНУЮ ОБЛАСТЬ ======
window.changeTheme = changeTheme;
window.showSection = showSection;
window.showModal = showModal;
window.closeModal = closeModal;
window.logout = logout;
window.clearCache = clearCache;
window.backupDatabase = backupDatabase;
window.exportDashboard = exportDashboard;
window.exportUsers = exportUsers;
window.exportPayments = exportPayments;
window.exportLogs = exportLogs;
window.saveBotSettings = saveBotSettings;
window.loadDashboard = loadDashboard;
window.searchUsers = searchUsers;
window.clearSearch = clearSearch;
window.filterUsers = filterUsers;
window.sortUsers = sortUsers;
window.filterPayments = filterPayments;
window.resetPaymentFilter = resetPaymentFilter;
window.showCreateTemplateModal = showCreateTemplateModal;
window.createTemplate = createTemplate;
window.insertVariable = insertVariable;
window.showAddAccountModal = showAddAccountModal;
window.addAccount = addAccount;
window.testAccount = testAccount;
window.toggleSelectAllUsers = toggleSelectAllUsers;
window.selectUserRow = selectUserRow;
window.toggleUserSelection = toggleUserSelection;
window.addDaysToUser = addDaysToUser;
window.loadActivity = loadActivity;

