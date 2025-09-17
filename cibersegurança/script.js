// Inicialização do banco de dados
function initDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("ProductManagementDB", 1);
        
        request.onerror = event => {
            reject("Erro ao abrir o banco de dados: " + event.target.errorCode);
        };
        
        request.onupgradeneeded = event => {
            const db = event.target.result;
            
            // Criar object store para usuários
            if (!db.objectStoreNames.contains('users')) {
                const userStore = db.createObjectStore('users', { keyPath: 'email' });
                userStore.createIndex('email', 'email', { unique: true });
                
                // Adicionar um usuário padrão para teste
                userStore.add({
                    name: "Usuário Demo",
                    email: "demo@email.com",
                    password: "123456"
                });
            }
            
            // Criar object store para produtos
            if (!db.objectStoreNames.contains('products')) {
                const productStore = db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
                productStore.createIndex('userId', 'userId', { unique: false });
            }
        };
        
        request.onsuccess = event => {
            resolve(event.target.result);
        };
    });
}

// Variáveis globais
let db;
let currentUser = null;

// Inicializar a aplicação
document.addEventListener('DOMContentLoaded', async () => {
    try {
        db = await initDatabase();
        checkAuthStatus();
        setupEventListeners();
    } catch (error) {
        showMessage('loginMessage', error, 'danger');
    }
});

// Configurar event listeners
function setupEventListeners() {
    // Login
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Registro
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('showRegister').addEventListener('click', showRegisterPage);
    document.getElementById('backToLogin').addEventListener('click', showLoginPage);
    
    // Produtos
    document.getElementById('productForm').addEventListener('submit', handleAddProduct);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
}

// Verificar status de autenticação
function checkAuthStatus() {
    const user = localStorage.getItem('currentUser');
    if (user) {
        currentUser = JSON.parse(user);
        showProductsPage();
        loadProducts();
    } else {
        showLoginPage();
    }
}

// Manipular login
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
        const user = await getUser(email);
        
        if (user && user.password === password) {
            currentUser = user;
            localStorage.setItem('currentUser', JSON.stringify(user));
            showProductsPage();
            loadProducts();
        } else {
            showMessage('loginMessage', 'E-mail ou senha incorretos.', 'danger');
        }
    } catch (error) {
        showMessage('loginMessage', 'Erro ao fazer login: ' + error, 'danger');
    }
}

// Manipular registro
async function handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    
    try {
        // Verificar se o usuário já existe
        const existingUser = await getUser(email);
        if (existingUser) {
            showMessage('registerMessage', 'Este e-mail já está cadastrado.', 'danger');
            return;
        }
        
        // Criar novo usuário
        const newUser = { name, email, password };
        await addUser(newUser);
        
        showMessage('registerMessage', 'Conta criada com sucesso! Faça login para continuar.', 'success');
        setTimeout(showLoginPage, 1500);
    } catch (error) {
        showMessage('registerMessage', 'Erro ao criar conta: ' + error, 'danger');
    }
}

// Manipular adição de produto
async function handleAddProduct(e) {
    e.preventDefault();
    
    const name = document.getElementById('productName').value;
    const description = document.getElementById('productDescription').value;
    const price = parseFloat(document.getElementById('productPrice').value);
    const quantity = parseInt(document.getElementById('productQuantity').value);
    
    try {
        const product = {
            name,
            description,
            price,
            quantity,
            userId: currentUser.email
        };
        
        await addProduct(product);
        document.getElementById('productForm').reset();
        loadProducts();
    } catch (error) {
        alert('Erro ao adicionar produto: ' + error);
    }
}

// Manipular logout
function handleLogout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    showLoginPage();
}

// Funções do banco de dados
function getUser(email) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['users'], 'readonly');
        const store = transaction.objectStore('users');
        const request = store.get(email);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function addUser(user) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['users'], 'readwrite');
        const store = transaction.objectStore('users');
        const request = store.add(user);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function addProduct(product) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['products'], 'readwrite');
        const store = transaction.objectStore('products');
        const request = store.add(product);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function getProducts() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['products'], 'readonly');
        const store = transaction.objectStore('products');
        const index = store.index('userId');
        const request = index.getAll(currentUser.email);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function deleteProduct(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['products'], 'readwrite');
        const store = transaction.objectStore('products');
        const request = store.delete(id);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Carregar produtos na tabela
async function loadProducts() {
    try {
        const products = await getProducts();
        const tableBody = document.getElementById('productsTable');
        tableBody.innerHTML = '';
        
        if (products.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum produto cadastrado.</td></tr>';
            return;
        }
        
        products.forEach(product => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${product.name}</td>
                <td>${product.description || '-'}</td>
                <td>R$ ${product.price.toFixed(2)}</td>
                <td>${product.quantity}</td>
                <td>
                    <button class="btn btn-sm btn-danger delete-btn" data-id="${product.id}">Excluir</button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
        // Adicionar event listeners para os botões de exclusão
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const id = parseInt(e.target.getAttribute('data-id'));
                if (confirm('Tem certeza que deseja excluir este produto?')) {
                    try {
                        await deleteProduct(id);
                        loadProducts();
                    } catch (error) {
                        alert('Erro ao excluir produto: ' + error);
                    }
                }
            });
        });
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
    }
}

// Funções para mostrar/ocultar páginas
function showLoginPage() {
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('registerPage').classList.add('hidden');
    document.getElementById('productsPage').classList.add('hidden');
    document.getElementById('userInfo').classList.add('hidden');
    document.getElementById('loginForm').reset();
    document.getElementById('loginMessage').classList.add('hidden');
}

function showRegisterPage() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('registerPage').classList.remove('hidden');
    document.getElementById('productsPage').classList.add('hidden');
    document.getElementById('userInfo').classList.add('hidden');
    document.getElementById('registerForm').reset();
    document.getElementById('registerMessage').classList.add('hidden');
}

function showProductsPage() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('registerPage').classList.add('hidden');
    document.getElementById('productsPage').classList.remove('hidden');
    document.getElementById('userInfo').classList.remove('hidden');
    document.getElementById('userName').textContent = currentUser.name;
}

// Mostrar mensagens
function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.classList.remove('hidden', 'alert-success', 'alert-danger');
    element.classList.add(`alert-${type}`);
}