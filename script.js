// Глобальные переменные
let currentUser = null;
let usersData = [];
let paymentsData = [];
let templatesData = [];
let accountsData = [];

// Telegram Web App инициализация
let tg = window.Telegram.WebApp;
let botToken = '8550838003:AAFu8_rLZRb2K7Zqj3IBPguiEVpic8IklEk';
let apiBase = 'http://localhost:5000/api'; // Или ваш домен

// Получаем user_id из URL
const urlParams = new URLSearchParams(window.location.search);
const userIdFromUrl = urlParams.get('user_id');

// Если нет в URL, используем из Telegram Web App
const tgUserId = tg.initDataUnsafe?.user?.id || userIdFromUrl;

// Проверяем права админа перед загрузкой
async function checkAdminBeforeLoad() {
    if (!tgUserId) {
        tg.showAlert('Ошибка авторизации!');
        tg.close();
        return false;
    }
    
    try {
        const response = await fetch(`${apiBase}/check-admin/${tgUserId}`);
        const data = await response.json();
        
        if (!data.is_admin) {
            tg.showAlert('У вас нет прав доступа к админ-панели!');
            tg.close();
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Ошибка проверки админа:', error);
        tg.showAlert('Ошибка подключения к серверу!');
        return false;
    }
}

// В начале загрузки страницы
document.addEventListener('DOMContentLoaded', async () => {
    const isAdmin = await checkAdminBeforeLoad();
    if (!isAdmin) return;
    
    // Продолжаем загрузку...
    tg.expand();
    tg.enableClosingConfirmation();
    
    // Загружаем данные пользователя
    await initUser();
    
    // Остальной код...
});

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', async () => {
    // Инициализируем Telegram Web App
    tg.expand();
    tg.enableClosingConfirmation();
    
    // Получаем данные пользователя
    await initUser();
    
    // Загружаем все данные
    await loadAllData();
    
    // Показываем интерфейс
    document.getElementById('loader').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    
    // Инициализируем графики
    initCharts();
});

// Инициализация пользователя
async function initUser() {
    const initData = tg.initDataUnsafe;
    
    if (initData.user) {
        currentUser = {
            id: initData.user.id,
            firstName: initData.user.first_name,
            lastName: initData.user.last_name || '',
            username: initData.user.username || '',
            photoUrl: initData.user.photo_url || null
        };
        
        // Обновляем UI с данными пользователя
        document.getElementById('username').textContent = 
            `${currentUser.firstName} ${currentUser.lastName}`;
        document.getElementById('userId').textContent = `ID: ${currentUser.id}`;
        
        // Загружаем аватарку
        if (currentUser.photoUrl) {
            document.getElementById('userAvatar').innerHTML = 
                `<img src="${currentUser.photoUrl}" alt="Avatar">`;
        }
        
        // Проверяем права админа
        await checkAdminStatus();
    }
}

// Проверка прав админа
async function checkAdminStatus() {
    try {
        const response = await fetch(`${apiBase}/check-admin/${currentUser.id}`);
        const data = await response.json();
        
        if (!data.isAdmin) {
            tg.showAlert('У вас нет прав доступа к админ-панели!');
            tg.close();
        }
    } catch (error) {
        console.error('Ошибка проверки админа:', error);
    }
}

// Загрузка всех данных
async function loadAllData() {
    try {
        // Загружаем параллельно все данные
        const [users, payments, templates, accounts, stats] = await Promise.all([
            fetchData('/users'),
            fetchData('/payments'),
            fetchData('/templates'),
            fetchData('/accounts'),
            fetchData('/stats')
        ]);
        
        usersData = users;
        paymentsData = payments;
        templatesData = templates;
        accountsData = accounts;
        
        // Обновляем UI
        updateDashboard(stats);
        updateUsersTable(users);
        updatePaymentsTable(payments);
        updateTemplatesGrid(templates);
        updateAccountsList(accounts);
        
        // Обновляем счетчики
        document.getElementById('usersCount').textContent = users.length;
        document.getElementById('paymentsCount').textContent = payments.filter(p => p.status === 'completed').length;
        document.getElementById('templatesCount').textContent = templates.length;
        document.getElementById('accountsCount').textContent = accounts.length;
        
        // Обновляем время
        updateLastUpdateTime();
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        showNotification('Ошибка загрузки данных', 'error');
    }
}

// Функция для загрузки данных
async function fetchData(endpoint) {
    const response = await fetch(`${apiBase}${endpoint}`, {
        headers: {
            'Authorization': `Bearer ${botToken}`,
            'Telegram-User-ID': currentUser.id
        }
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
}

// Обновление дашборда
function updateDashboard(stats) {
    document.getElementById('totalUsers').textContent = stats.totalUsers;
    document.getElementById('activeUsers').textContent = stats.activeUsers;
    document.getElementById('todayRevenue').textContent = `$${stats.todayRevenue}`;
    document.getElementById('totalRevenue').textContent = `$${stats.totalRevenue}`;
    document.getElementById('todayCampaigns').textContent = stats.todayCampaigns;
    document.getElementById('totalEmails').textContent = stats.totalEmails;
    document.getElementById('activeAccounts').textContent = stats.activeAccounts;
    document.getElementById('totalIncome').textContent = `$${stats.totalRevenue}`;
    
    // Обновляем графики
    updateCharts(stats.charts);
}

// Обновление таблицы пользователей
function updateUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const row = document.createElement('tr');
        
        // Определяем статус подписки
        const subscriptionStatus = user.subscription_days > 0 ? 
            `<span class="status-badge active">${user.subscription_days} дней</span>` :
            `<span class="status-badge inactive">Нет подписки</span>`;
        
        row.innerHTML = `
            <td>${user.user_id}</td>
            <td>
                <div class="user-cell">
                    <div class="user-avatar-small">
                        <i class="fas fa-user"></i>
                    </div>
                    <div>
                        <div class="user-name">${user.first_name} ${user.last_name || ''}</div>
                        <div class="user-username">@${user.username || 'нет'}</div>
                    </div>
                </div>
            </td>
            <td>${subscriptionStatus}</td>
            <td>$${user.total_spent || 0}</td>
            <td>${new Date(user.registration_date).toLocaleDateString()}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-small" onclick="editUser(${user.user_id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-danger" onclick="deleteUser(${user.user_id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Обновление таблицы платежей
function updatePaymentsTable(payments) {
    const tbody = document.getElementById('paymentsTableBody');
    tbody.innerHTML = '';
    
    // Статистика платежей
    const today = new Date().toISOString().split('T')[0];
    const todayPayments = payments.filter(p => p.date.startsWith(today) && p.status === 'completed');
    const monthPayments = payments.filter(p => p.date.includes(new Date().getMonth() + 1) && p.status === 'completed');
    
    const todaySum = todayPayments.reduce((sum, p) => sum + p.amount, 0);
    const monthSum = monthPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalSum = payments.filter(p => p.status === 'completed')
                            .reduce((sum, p) => sum + p.amount, 0);
    
    document.getElementById('todayPayments').textContent = `$${todaySum}`;
    document.getElementById('monthPayments').textContent = `$${monthSum}`;
    document.getElementById('totalPayments').textContent = `$${totalSum}`;
    
    // Заполняем таблицу
    payments.forEach(payment => {
        const row = document.createElement('tr');
        
        const statusClass = payment.status === 'completed' ? 'status-success' : 
                          payment.status === 'pending' ? 'status-warning' : 'status-danger';
        
        row.innerHTML = `
            <td>${payment.id}</td>
            <td>${payment.user_id}</td>
            <td>${payment.days}</td>
            <td>$${payment.amount}</td>
            <td><span class="status-badge ${statusClass}">${payment.status}</span></td>
            <td><code class="transaction-hash">${payment.transaction_hash || 'Нет'}</code></td>
            <td>${new Date(payment.date).toLocaleString()}</td>
            <td>
                <button class="btn-small" onclick="verifyPayment(${payment.id})">
                    <i class="fas fa-check"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Обновление сетки шаблонов
function updateTemplatesGrid(templates) {
    const grid = document.getElementById('templatesGrid');
    grid.innerHTML = '';
    
    templates.forEach(template => {
        const card = document.createElement('div');
        card.className = 'template-card';
        
        card.innerHTML = `
            <div class="template-header">
                <h4>${template.name}</h4>
                <div class="template-actions">
                    <button class="btn-small" onclick="editTemplate('${template.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-danger" onclick="deleteTemplate('${template.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="template-subject">
                <strong>Тема:</strong> ${template.subject}
            </div>
            <div class="template-preview">
                ${template.text.substring(0, 100)}...
            </div>
            <div class="template-footer">
                <span class="template-stats">
                    <i class="fas fa-paper-plane"></i> ${template.usage_count || 0} раз
                </span>
                <span class="template-date">
                    ${new Date(template.created).toLocaleDateString()}
                </span>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

// Обновление списка аккаунтов
function updateAccountsList(accounts) {
    const list = document.getElementById('accountsList');
    list.innerHTML = '';
    
    accounts.forEach(account => {
        const item = document.createElement('div');
        item.className = 'account-item';
        
        item.innerHTML = `
            <div class="account-info">
                <div class="account-email">
                    <i class="fas fa-envelope"></i>
                    <strong>${account.email}</strong>
                </div>
                <div class="account-stats">
                    <span class="stat">
                        <i class="fas fa-paper-plane"></i>
                        Отправлено: ${account.sent_count || 0}
                    </span>
                    <span class="stat">
                        <i class="fas fa-calendar"></i>
                        Добавлен: ${new Date(account.added_date).toLocaleDateString()}
                    </span>
                </div>
            </div>
            <div class="account-actions">
                <button class="btn-small" onclick="testAccount('${account.email}')">
                    <i class="fas fa-vial"></i> Тест
                </button>
                <button class="btn-danger" onclick="deleteAccount('${account.email}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        list.appendChild(item);
    });
}

// Инициализация графиков
function initCharts() {
    window.revenueChart = new Chart(document.getElementById('revenueChart'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Доход ($)',
                data: [],
                borderColor: '#4361ee',
                backgroundColor: 'rgba(67, 97, 238, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
    
    window.usersChart = new Chart(document.getElementById('usersChart'), {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Новые пользователи',
                data: [],
                backgroundColor: '#4cc9f0',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// Обновление графиков
function updateCharts(chartData) {
    if (window.revenueChart && chartData.revenue) {
        window.revenueChart.data.labels = chartData.revenue.labels;
        window.revenueChart.data.datasets[0].data = chartData.revenue.data;
        window.revenueChart.update();
    }
    
    if (window.usersChart && chartData.users) {
        window.usersChart.data.labels = chartData.users.labels;
        window.usersChart.data.datasets[0].data = chartData.users.data;
        window.usersChart.update();
    }
}

// Показ секций
function showSection(sectionId) {
    // Скрываем все секции
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Показываем нужную секцию
    document.getElementById(sectionId).classList.add('active');
    
    // Обновляем активный пункт меню
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    document.querySelector(`[onclick="showSection('${sectionId}')"]`).classList.add('active');
}

// Модальные окна
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

// Создание шаблона
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
        showNotification('Заполните все поля', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`${apiBase}/templates`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${botToken}`
            },
            body: JSON.stringify({
                name,
                subject,
                text,
                created_by: currentUser.id
            })
        });
        
        if (response.ok) {
            showNotification('Шаблон создан успешно', 'success');
            closeModal();
            await loadAllData();
        } else {
            throw new Error('Ошибка создания шаблона');
        }
    } catch (error) {
        showNotification('Ошибка создания шаблона', 'error');
        console.error(error);
    }
}

// Добавление аккаунта
function showAddAccountModal() {
    showModal('addAccountModal');
}

async function addAccount() {
    const email = document.getElementById('accountEmail').value.trim();
    const password = document.getElementById('accountPassword').value.trim();
    
    if (!email || !password) {
        showNotification('Заполните все поля', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`${apiBase}/accounts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${botToken}`
            },
            body: JSON.stringify({
                email,
                password,
                added_by: currentUser.id
            })
        });
        
        if (response.ok) {
            showNotification('Аккаунт добавлен', 'success');
            closeModal();
            await loadAllData();
        } else {
            throw new Error('Ошибка добавления аккаунта');
        }
    } catch (error) {
        showNotification('Ошибка добавления аккаунта', 'error');
        console.error(error);
    }
}

// Уведомления
function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-icon">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'info-circle'}"></i>
        </div>
        <div class="notification-message">${message}</div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(notification);
    
    // Автоудаление через 5 секунд
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Обновление времени последнего обновления
function updateLastUpdateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    document.getElementById('lastUpdate').textContent = `Обновлено: ${timeString}`;
}

// Загрузка дашборда
async function loadDashboard() {
    try {
        const stats = await fetchData('/stats');
        updateDashboard(stats);
        updateLastUpdateTime();
        showNotification('Данные обновлены', 'success');
    } catch (error) {
        showNotification('Ошибка обновления данных', 'error');
    }
}

// Выход
function logout() {
    tg.showConfirm('Вы уверены, что хотите выйти?', (confirmed) => {
        if (confirmed) {
            tg.close();
        }
    });
}

// Вставка переменных в текст шаблона
function insertVariable(variable) {
    const textarea = document.getElementById('templateText');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    textarea.value = text.substring(0, start) + variable + text.substring(end);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + variable.length;
}

// Экспорт пользователей
function exportUsers() {
    const csv = convertToCSV(usersData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    a.href = url;
    a.download = `users_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showNotification('Данные экспортированы в CSV', 'success');
}

// Конвертация в CSV
function convertToCSV(data) {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const rows = data.map(row => 
        headers.map(header => 
            JSON.stringify(row[header] || '')
        ).join(',')
    );
    
    return [headers.join(','), ...rows].join('\n');
}