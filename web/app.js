const SUPABASE_URL = 'https://xzkjgvdyfoertreyjdag.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6a2pndmR5Zm9lcnRyZXlqZGFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNTc1MTcsImV4cCI6MjEwNjYzMzUxN30.0Ohd3OEbQ7DC8_vBT3vXlONZc8-B3Jw9dOuqa9RnPD0';
const ADMIN_LOGIN_EMAIL = 'teffbeauty767@gmail.com';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const state = {
  session: null,
  profile: null,
  settings: null,
  products: [],
  myOrders: [],
  myOrderItems: [],
  myPayments: [],
  adminProfiles: [],
  adminOrders: [],
  adminOrderItems: [],
  adminPayments: [],
  adminPaymentOrders: [],
  cart: loadCart(),
  qty: {},
  view: 'home',
  authMode: 'login',
  menuOpen: false,
  modal: null,
  adminTab: 'products',
  productFilter: 'ativos',
  clientFilter: 'todos',
  editingProductId: null,
  loading: true
};

init();

async function init() {
  registerServiceWorker();
  const { data } = await db.auth.getSession();
  state.session = data.session;
  if (state.session) await refreshAll();
  state.loading = false;
  render();

  db.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    state.profile = null;
    state.cart = loadCart();
    if (session) await refreshAll();
    render();
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

async function refreshAll() {
  await loadSettings();
  await loadProfile();
  await loadProducts();
  await loadMyOrders();
  await loadMyPayments();
  if (isAdmin()) await loadAdminData();
}

async function loadSettings() {
  const { data, error } = await db.from('app_settings').select('*').eq('id', true).maybeSingle();
  if (error) showToast(error.message);
  state.settings = data || { store_name: 'Teff Exclusivo', pix_key: '', pix_holder: '', payment_due_day: 7 };
}

async function loadProfile() {
  if (!state.session) return;
  const user = state.session.user;
  const { data, error } = await db.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) showToast(error.message);
  state.profile = data || {
    id: user.id,
    role: 'cliente',
    full_name: user.user_metadata?.full_name || user.email || 'Cliente',
    username: user.user_metadata?.username || '',
    whatsapp: user.user_metadata?.whatsapp || '',
    is_active: true
  };
}

async function loadProducts() {
  let query = db.from('products').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true });
  if (!isAdmin()) query = query.eq('is_active', true).eq('is_hidden', false);
  const { data, error } = await query;
  if (error) showToast(error.message);
  state.products = data || [];
}

async function loadMyOrders() {
  if (!state.session) return;
  const { data: orders, error } = await db
    .from('orders')
    .select('*')
    .eq('customer_id', state.session.user.id)
    .order('created_at', { ascending: false });

  if (error) showToast(error.message);
  state.myOrders = orders || [];
  const ids = state.myOrders.map((order) => order.id);

  if (!ids.length) {
    state.myOrderItems = [];
    return;
  }

  const { data: items, error: itemsError } = await db
    .from('order_items')
    .select('*')
    .in('order_id', ids)
    .order('created_at', { ascending: true });

  if (itemsError) showToast(itemsError.message);
  state.myOrderItems = items || [];
}

async function loadMyPayments() {
  if (!state.session) return;
  const { data, error } = await db
    .from('payments')
    .select('*')
    .eq('customer_id', state.session.user.id)
    .order('created_at', { ascending: false });

  if (error) showToast(error.message);
  state.myPayments = data || [];
}

async function loadAdminData() {
  const [profiles, orders, orderItems, payments, paymentOrders, products] = await Promise.all([
    db.from('profiles').select('*').order('created_at', { ascending: false }),
    db.from('orders').select('*').order('created_at', { ascending: false }),
    db.from('order_items').select('*').order('created_at', { ascending: true }),
    db.from('payments').select('*').order('created_at', { ascending: false }),
    db.from('payment_orders').select('*'),
    db.from('products').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true })
  ]);

  for (const result of [profiles, orders, orderItems, payments, paymentOrders, products]) {
    if (result.error) showToast(result.error.message);
  }

  state.adminProfiles = profiles.data || [];
  state.adminOrders = orders.data || [];
  state.adminOrderItems = orderItems.data || [];
  state.adminPayments = payments.data || [];
  state.adminPaymentOrders = paymentOrders.data || [];
  state.products = products.data || state.products;
}

function render() {
  if (state.loading) return;
  if (!state.session) {
    app.className = '';
    app.innerHTML = renderAuth();
    return;
  }

  app.className = 'app-shell';
  app.innerHTML = `
    <header class="topbar">
      <button class="icon-button" data-action="toggle-menu" aria-label="Abrir menu">☰</button>
      <div class="hello">
        <strong>Olá, ${escapeHtml(displayName())}</strong>
        <span>${isAdmin() ? 'Painel e loja conectados.' : 'Que tal se cuidar um pouquinho hoje?'}</span>
      </div>
      <button class="icon-button" data-action="nav" data-view="cart" aria-label="Abrir carrinho">⌑${cartCount() ? `<span class="badge-dot">${cartCount()}</span>` : ''}</button>
    </header>
    ${state.menuOpen ? '<div class="sidebar-backdrop" data-action="close-menu"></div>' : ''}
    ${renderSidebar()}
    <main class="main">${renderCurrentView()}</main>
    ${renderModal()}
  `;
}

function renderAuth() {
  const isLogin = state.authMode === 'login';
  return `
    <section class="auth-page">
      <div class="auth-art" aria-hidden="true"></div>
      <div class="auth-panel">
        <div>
          <div class="brand-mark">TEFF</div>
          <h1>Teff Exclusivo</h1>
          <p>Pedidos, entregas e pagamentos em uma loja online compartilhada.</p>
        </div>
        <div class="auth-tabs">
          <button class="tab-button ${isLogin ? 'active' : ''}" data-action="auth-mode" data-mode="login">Entrar</button>
          <button class="tab-button ${!isLogin ? 'active' : ''}" data-action="auth-mode" data-mode="signup">Criar conta</button>
        </div>
        ${isLogin ? renderLoginForm() : renderSignupForm()}
      </div>
    </section>
  `;
}

function renderLoginForm() {
  return `
    <form class="form-grid" data-form="login">
      <div class="form-row">
        <label>Usuário</label>
        <input class="input" name="username" autocomplete="username" autocapitalize="none" required>
      </div>
      <div class="form-row">
        <label>Senha</label>
        <input class="input" name="password" type="password" autocomplete="current-password" required>
      </div>
      <button class="primary full" type="submit">Entrar</button>
    </form>
  `;
}

function renderSignupForm() {
  return `
    <form class="form-grid" data-form="signup">
      <div class="form-row">
        <label>Nome</label>
        <input class="input" name="full_name" autocomplete="name" required>
      </div>
      <div class="form-row">
        <label>WhatsApp</label>
        <input class="input" name="whatsapp" inputmode="tel" autocomplete="tel">
      </div>
      <div class="form-row">
        <label>Nome de usuário</label>
        <input class="input" name="username" autocomplete="username" autocapitalize="none" required>
      </div>
      <div class="form-row">
        <label>Senha</label>
        <input class="input" name="password" type="password" autocomplete="new-password" minlength="6" required>
      </div>
      <button class="primary full" type="submit">Criar conta</button>
    </form>
  `;
}

function renderSidebar() {
  const item = (view, label) => `<button class="nav-item ${state.view === view ? 'active' : ''}" data-action="nav" data-view="${view}">${label}</button>`;
  return `
    <aside class="sidebar ${state.menuOpen ? 'open' : ''}">
      <div class="sidebar-brand">
        <strong>Teff</strong>
        <span>${escapeHtml(state.settings?.store_name || 'Teff Exclusivo')}</span>
      </div>
      <nav class="nav-list">
        ${item('home', 'Início')}
        ${item('cart', 'Carrinho')}
        ${item('orders', 'Pedidos')}
        ${item('profile', 'Configurações')}
        ${isAdmin() ? item('admin', 'Administração') : ''}
      </nav>
      <div class="nav-spacer"></div>
      <button class="nav-item danger" data-action="logout">Sair</button>
    </aside>
  `;
}

function renderCurrentView() {
  if (state.view === 'cart') return renderCart();
  if (state.view === 'orders') return renderOrders();
  if (state.view === 'profile') return renderProfile();
  if (state.view === 'admin' && isAdmin()) return renderAdmin();
  return renderHome();
}

function renderHome() {
  const products = activeProducts();
  const debt = pendingDebt();
  return `
    <div class="stack">
      <section class="vitrine" aria-label="Vitrine Teff Beauty"></section>
      ${debt > 0 ? `
        <div class="notice">
          <span>Você possui pendente <strong>${formatMoney(debt)}</strong></span>
          <button class="secondary" data-action="nav" data-view="cart">Ver carrinho</button>
        </div>
      ` : ''}
      <div class="section-head">
        <div>
          <h2 class="page-title">Vitrine</h2>
          <p class="section-subtitle">Escolha a quantidade antes de adicionar ao carrinho.</p>
        </div>
      </div>
      ${products.length ? `<div class="grid-products">${products.map(renderProductCard).join('')}</div>` : renderEmpty('Nenhum produto ativo na vitrine ainda.')}
    </div>
  `;
}

function renderProductCard(product) {
  const qty = productQty(product.id);
  const stock = Number(product.stock_quantity || 0);
  return `
    <article class="product-card">
      ${renderProductImage(product)}
      <div class="product-body">
        <div>
          <div class="product-title">${escapeHtml(product.name)}</div>
          <div class="meta">${escapeHtml(product.category || 'Vitrine')} · ${stock} un.</div>
        </div>
        <div class="price">${formatMoney(product.price)}</div>
        <div class="qty-row">
          <button data-action="product-qty" data-product-id="${product.id}" data-delta="-1">−</button>
          <input class="input" data-qty-product="${product.id}" type="number" min="1" max="${Math.max(stock, 1)}" value="${qty}">
          <button data-action="product-qty" data-product-id="${product.id}" data-delta="1">+</button>
        </div>
        <button class="primary full" data-action="add-cart" data-product-id="${product.id}" ${stock <= 0 ? 'disabled' : ''}>${stock <= 0 ? 'Sem estoque' : 'Adicionar'}</button>
      </div>
    </article>
  `;
}

function renderCart() {
  const total = cartTotal();
  const debt = pendingDebt();
  return `
    <div class="stack">
      <div class="section-head">
        <div>
          <h2 class="page-title">Carrinho</h2>
          <p class="section-subtitle">Revise os produtos, ajuste quantidades e finalize o pedido.</p>
        </div>
      </div>
      ${state.cart.length ? `
        <div class="panel stack">
          ${state.cart.map((item, index) => renderCartItem(item, index)).join('')}
          <div class="item-line"><strong>Total do carrinho</strong><strong>${formatMoney(total)}</strong></div>
          <button class="primary full" data-action="finalize-order">Finalizar pedido</button>
        </div>
      ` : renderEmpty('Seu carrinho está vazio.')}
      <div class="panel stack">
        <div>
          <h3 class="card-title">Pagamento do mês</h3>
          <p class="section-subtitle">Use esta opção para pagar todos os pedidos pendentes.</p>
        </div>
        <div class="item-line"><span>Total pendente</span><strong>${formatMoney(debt)}</strong></div>
        <button class="success-btn full" data-action="open-pix" ${debt <= 0 ? 'disabled' : ''}>Pagar carrinho do mês</button>
      </div>
    </div>
  `;
}

function renderCartItem(item, index) {
  return `
    <div class="item-line">
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <div class="meta">${formatMoney(item.price)} cada</div>
      </div>
      <div class="qty-mini">
        <button data-action="cart-qty" data-index="${index}" data-delta="-1">−</button>
        <input class="input" data-cart-index="${index}" type="number" min="1" value="${item.quantity}">
        <button data-action="cart-qty" data-index="${index}" data-delta="1">+</button>
      </div>
      <button class="secondary" data-action="remove-cart" data-index="${index}">Remover</button>
    </div>
  `;
}

function renderOrders() {
  const pending = state.myOrders.filter((order) => ['CONFIRMADO', 'ENTREGUE'].includes(order.status) && order.payment_status !== 'PAGO');
  const closed = state.myOrders.filter((order) => order.payment_status === 'PAGO' || ['CANCELADO', 'FECHADO', 'PAGO'].includes(order.status));
  return `
    <div class="stack">
      <div class="section-head">
        <div>
          <h2 class="page-title">Pedidos</h2>
          <p class="section-subtitle">Confirme entrega ou cancele pedidos ainda não entregues.</p>
        </div>
      </div>
      <section class="stack">
        <h3 class="card-title">Pendentes</h3>
        ${pending.length ? `<div class="list">${pending.map((order) => renderOrderCard(order, true)).join('')}</div>` : renderEmpty('Nenhum pedido pendente agora.')}
      </section>
      ${closed.length ? `
        <section class="stack">
          <h3 class="card-title">Histórico</h3>
          <div class="list">${closed.slice(0, 8).map((order) => renderOrderCard(order, false)).join('')}</div>
        </section>
      ` : ''}
    </div>
  `;
}

function renderOrderCard(order, actionable) {
  const items = itemsForOrder(order.id, state.myOrderItems);
  return `
    <article class="order-card">
      <div class="order-top">
        <div>
          <div class="order-code">${escapeHtml(order.order_code || 'Pedido')}</div>
          <div class="meta">${formatDate(order.created_at)} · ${items.map((item) => `${item.quantity}x ${escapeHtml(item.product_name)}`).join(', ')}</div>
        </div>
        ${statusBadge(order.status, order.payment_status)}
      </div>
      <div class="item-line"><span>Total</span><strong>${formatMoney(order.total_amount)}</strong></div>
      ${actionable ? `
        <div class="actions">
          <button class="success-btn" data-action="confirm-delivery" data-order-id="${order.id}" ${order.status !== 'CONFIRMADO' ? 'disabled' : ''}>Confirmar entrega</button>
          <button class="danger-btn" data-action="cancel-order" data-order-id="${order.id}" ${order.status !== 'CONFIRMADO' ? 'disabled' : ''}>Cancelar pedido</button>
        </div>
      ` : ''}
    </article>
  `;
}

function renderProfile() {
  const profile = state.profile || {};
  return `
    <div class="stack">
      <div class="section-head">
        <div>
          <h2 class="page-title">Configurações</h2>
          <p class="section-subtitle">Atualize nome, WhatsApp e nome de usuário.</p>
        </div>
      </div>
      <form class="panel form-grid" data-form="profile">
        <div class="form-row">
          <label>Nome</label>
          <input class="input" name="full_name" value="${escapeAttr(profile.full_name || '')}" required>
        </div>
        <div class="form-row">
          <label>WhatsApp</label>
          <input class="input" name="whatsapp" value="${escapeAttr(profile.whatsapp || '')}" inputmode="tel">
        </div>
        <div class="form-row">
          <label>Nome de usuário</label>
          <input class="input" name="username" value="${escapeAttr(profile.username || '')}" autocapitalize="none">
        </div>
        <button class="primary full" type="submit">Salvar alterações</button>
      </form>
    </div>
  `;
}

function renderAdmin() {
  const orders = state.adminOrders;
  const pending = orders.filter((order) => order.payment_status === 'PENDENTE' && order.status !== 'CANCELADO').reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const paid = orders.filter((order) => order.payment_status === 'PAGO').reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const profit = orders.reduce((sum, order) => sum + Number(order.profit_amount || 0), 0);
  return `
    <div class="stack">
      <div class="section-head">
        <div>
          <h2 class="page-title">Administração</h2>
          <p class="section-subtitle">Dados online sincronizados entre aparelhos.</p>
        </div>
      </div>
      <div class="summary-grid">
        <div class="stat-card"><span>Pendente</span><strong>${formatMoney(pending)}</strong></div>
        <div class="stat-card"><span>Pago</span><strong>${formatMoney(paid)}</strong></div>
        <div class="stat-card"><span>Lucro histórico</span><strong>${formatMoney(profit)}</strong></div>
      </div>
      <div class="segment">
        ${adminTab('products', 'Produtos')}
        ${adminTab('clients', 'Clientes')}
        ${adminTab('orders', 'Pedidos')}
        ${adminTab('payments', 'Pagamentos')}
        ${adminTab('closings', 'Fechamentos')}
        ${adminTab('settings', 'Configurações')}
      </div>
      ${renderAdminTab()}
    </div>
  `;
}

function renderAdminTab() {
  if (state.adminTab === 'clients') return renderAdminClients();
  if (state.adminTab === 'orders') return renderAdminOrders();
  if (state.adminTab === 'payments') return renderAdminPayments();
  if (state.adminTab === 'closings') return renderAdminClosings();
  if (state.adminTab === 'settings') return renderAdminSettings();
  return renderAdminProducts();
}

function renderAdminProducts() {
  const editing = state.editingProductId ? state.products.find((product) => product.id === state.editingProductId) : null;
  const products = filterAdminProducts();
  return `
    <div class="admin-grid">
      <form class="panel form-grid" data-form="product">
        <input type="hidden" name="id" value="${escapeAttr(editing?.id || '')}">
        <div class="section-head">
          <div>
            <h3 class="card-title">${editing ? 'Editar produto' : 'Novo produto'}</h3>
            <p class="section-subtitle">Produtos ativos aparecem para clientes.</p>
          </div>
          ${editing ? '<button class="secondary" type="button" data-action="new-product">Novo</button>' : ''}
        </div>
        <div class="two-col">
          <div class="form-row"><label>Nome</label><input class="input" name="name" value="${escapeAttr(editing?.name || '')}" required></div>
          <div class="form-row"><label>Categoria</label><input class="input" name="category" value="${escapeAttr(editing?.category || 'Vitrine')}"></div>
        </div>
        <div class="three-col">
          <div class="form-row"><label>Preço</label><input class="input" name="price" inputmode="decimal" value="${editing ? Number(editing.price || 0) : ''}" required></div>
          <div class="form-row"><label>Custo</label><input class="input" name="cost" inputmode="decimal" value="${editing ? Number(editing.cost || 0) : ''}"></div>
          <div class="form-row"><label>Estoque</label><input class="input" name="stock_quantity" type="number" min="0" value="${editing ? Number(editing.stock_quantity || 0) : 0}"></div>
        </div>
        <div class="form-row"><label>Imagem URL</label><input class="input" name="image_url" value="${escapeAttr(editing?.image_url || '')}"></div>
        <div class="form-row"><label>Descrição</label><textarea class="textarea" name="description">${escapeHtml(editing?.description || '')}</textarea></div>
        <div class="actions">
          <label><input type="checkbox" name="is_active" ${editing?.is_active === false ? '' : 'checked'}> Ativo</label>
          <label><input type="checkbox" name="is_hidden" ${editing?.is_hidden ? 'checked' : ''}> Oculto</label>
        </div>
        <button class="primary full" type="submit">Salvar produto</button>
      </form>
      <div class="panel stack">
        <div class="segment">
          ${filterButton('product-filter', 'todos', 'Todos', state.productFilter)}
          ${filterButton('product-filter', 'ativos', 'Ativos', state.productFilter)}
          ${filterButton('product-filter', 'ocultos', 'Ocultos', state.productFilter)}
        </div>
        ${products.length ? products.map(renderAdminProductCard).join('') : renderEmpty('Nenhum produto nessa guia.')}
      </div>
    </div>
  `;
}

function renderAdminProductCard(product) {
  const hidden = product.is_hidden || !product.is_active;
  return `
    <article class="order-card admin-product-card">
      ${renderProductImage(product)}
      <div class="stack">
        <div class="order-top">
          <div>
            <strong>${escapeHtml(product.name)}</strong>
            <div class="meta">${escapeHtml(product.category || 'Vitrine')} · estoque ${product.stock_quantity || 0}</div>
          </div>
          ${hidden ? '<span class="status bad">OCULTO</span>' : '<span class="status ok">ATIVO</span>'}
        </div>
        <div class="item-line"><span>Venda ${formatMoney(product.price)}</span><strong>Custo ${formatMoney(product.cost)}</strong></div>
        <div class="actions">
          <button class="secondary" data-action="edit-product" data-product-id="${product.id}">Editar</button>
          <button class="${hidden ? 'success-btn' : 'danger-btn'}" data-action="toggle-product" data-product-id="${product.id}">${hidden ? 'Ativar' : 'Ocultar'}</button>
        </div>
      </div>
    </article>
  `;
}

function renderAdminClients() {
  const profiles = filterAdminClients();
  return `
    <div class="panel stack">
      <div class="segment">
        ${filterButton('client-filter', 'todos', 'Todos', state.clientFilter)}
        ${filterButton('client-filter', 'ativos', 'Ativos', state.clientFilter)}
        ${filterButton('client-filter', 'ocultos', 'Ocultos', state.clientFilter)}
      </div>
      ${profiles.length ? profiles.map(renderAdminClientCard).join('') : renderEmpty('Nenhum cliente nessa guia.')}
    </div>
  `;
}

function renderAdminClientCard(profile) {
  return `
    <article class="order-card">
      <div class="order-top">
        <div>
          <div class="order-code">${escapeHtml(profile.full_name || profile.username || 'Cliente')}</div>
          <div class="meta">@${escapeHtml(profile.username || 'sem-usuario')} · ${escapeHtml(profile.whatsapp || 'Sem WhatsApp')}</div>
        </div>
        ${profile.is_active ? '<span class="status ok">ATIVO</span>' : '<span class="status bad">OCULTO</span>'}
      </div>
      <div class="actions">
        <button class="${profile.is_active ? 'danger-btn' : 'success-btn'}" data-action="toggle-client" data-client-id="${profile.id}">${profile.is_active ? 'Ocultar cliente' : 'Reativar cliente'}</button>
      </div>
    </article>
  `;
}

function renderAdminOrders() {
  return `
    <div class="panel stack">
      ${state.adminOrders.length ? state.adminOrders.map((order) => {
        const customer = state.adminProfiles.find((profile) => profile.id === order.customer_id);
        const items = itemsForOrder(order.id, state.adminOrderItems);
        return `
          <article class="order-card">
            <div class="order-top">
              <div>
                <div class="order-code">${escapeHtml(order.order_code || 'Pedido')}</div>
                <div class="meta">${escapeHtml(customer?.full_name || customer?.username || 'Cliente')} · ${formatDate(order.created_at)}</div>
              </div>
              ${statusBadge(order.status, order.payment_status)}
            </div>
            <div class="meta">${items.map((item) => `${item.quantity}x ${escapeHtml(item.product_name)}`).join(', ') || 'Sem itens'}</div>
            <div class="item-line"><span>Total</span><strong>${formatMoney(order.total_amount)}</strong></div>
            <div class="item-line"><span>Custo salvo</span><strong>${formatMoney(order.cost_amount)}</strong></div>
            <div class="item-line"><span>Lucro histórico</span><strong>${formatMoney(order.profit_amount)}</strong></div>
          </article>
        `;
      }).join('') : renderEmpty('Nenhum pedido registrado.')}
    </div>
  `;
}

function renderAdminPayments() {
  return `
    <div class="panel stack">
      ${state.adminPayments.length ? state.adminPayments.map((payment) => {
        const customer = state.adminProfiles.find((profile) => profile.id === payment.customer_id);
        return `
          <article class="order-card">
            <div class="order-top">
              <div>
                <div class="order-code">${escapeHtml(customer?.full_name || customer?.username || 'Cliente')}</div>
                <div class="meta">${formatDate(payment.created_at)} · ${escapeHtml(payment.method)}</div>
              </div>
              ${payment.status === 'PAGO' ? '<span class="status ok">PAGO</span>' : '<span class="status">PENDENTE</span>'}
            </div>
            <div class="item-line"><span>Valor</span><strong>${formatMoney(payment.amount)}</strong></div>
            <div class="pix-box">Pix usado: ${escapeHtml(payment.pix_key_snapshot || state.settings?.pix_key || 'sem chave')}</div>
            <button class="success-btn full" data-action="mark-payment-paid" data-payment-id="${payment.id}" ${payment.status === 'PAGO' ? 'disabled' : ''}>Marcar como pago</button>
          </article>
        `;
      }).join('') : renderEmpty('Nenhum pagamento criado.')}
    </div>
  `;
}

function renderAdminClosings() {
  const currentOrders = ordersThisMonth(state.adminOrders);
  const currentTotal = currentOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const currentProfit = currentOrders.reduce((sum, order) => sum + Number(order.profit_amount || 0), 0);
  return `
    <div class="panel stack">
      <div>
        <h3 class="card-title">Fechamento do ciclo</h3>
        <p class="section-subtitle">Exporte a relação detalhada de pedidos e pagamentos do mês atual.</p>
      </div>
      <div class="summary-grid">
        <div class="stat-card"><span>Pedidos</span><strong>${currentOrders.length}</strong></div>
        <div class="stat-card"><span>Total</span><strong>${formatMoney(currentTotal)}</strong></div>
        <div class="stat-card"><span>Lucro</span><strong>${formatMoney(currentProfit)}</strong></div>
      </div>
      <button class="primary full" data-action="export-pdf">Exportar PDF do ciclo</button>
    </div>
  `;
}

function renderAdminSettings() {
  return `
    <form class="panel form-grid" data-form="settings">
      <h3 class="card-title">Configurações da loja</h3>
      <div class="form-row"><label>Nome da loja</label><input class="input" name="store_name" value="${escapeAttr(state.settings?.store_name || 'Teff Exclusivo')}"></div>
      <div class="form-row"><label>Chave Pix</label><input class="input" name="pix_key" value="${escapeAttr(state.settings?.pix_key || '')}"></div>
      <div class="form-row"><label>Titular Pix</label><input class="input" name="pix_holder" value="${escapeAttr(state.settings?.pix_holder || '')}"></div>
      <div class="form-row"><label>Dia do próximo pagamento</label><input class="input" name="payment_due_day" type="number" min="1" max="31" value="${Number(state.settings?.payment_due_day || 7)}"></div>
      <button class="primary full" type="submit">Salvar configurações</button>
    </form>
  `;
}

function renderModal() {
  if (!state.modal) return '';
  if (state.modal.type === 'pix') {
    const total = pendingDebt();
    const pixKey = state.settings?.pix_key || 'Chave Pix ainda não cadastrada';
    return `
      <div class="modal-backdrop" data-action="close-modal">
        <div class="modal" data-modal-card>
          <div class="modal-head">
            <div>
              <h3 class="card-title">Pagamento Pix</h3>
              <p class="section-subtitle">Pague o total de ${formatMoney(total)}</p>
            </div>
            <button class="icon-button" data-action="close-modal">×</button>
          </div>
          <div class="stack">
            <div class="pix-box">${escapeHtml(pixKey)}</div>
            <div class="actions">
              <button class="secondary" data-action="copy-pix">Copiar chave</button>
              <button class="success-btn" data-action="create-payment">Registrar intenção de pagamento</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  return '';
}

function adminTab(tab, label) {
  return `<button class="${state.adminTab === tab ? 'active' : ''}" data-action="admin-tab" data-tab="${tab}">${label}</button>`;
}

function filterButton(action, value, label, current) {
  return `<button class="${value === current ? 'active' : ''}" data-action="${action}" data-value="${value}">${label}</button>`;
}

function renderProductImage(product) {
  if (product.image_url) {
    return `<div class="product-image"><img src="${escapeAttr(product.image_url)}" alt="${escapeAttr(product.name)}" loading="lazy"></div>`;
  }
  const initials = (product.name || 'Teff').slice(0, 2).toUpperCase();
  return `<div class="product-image" aria-hidden="true">${escapeHtml(initials)}</div>`;
}

function renderEmpty(text) {
  return `<div class="empty">${escapeHtml(text)}</div>`;
}

app.addEventListener('click', (event) => {
  const actionTarget = event.target.closest('[data-action]');
  if (!actionTarget) return;
  const modalCard = event.target.closest('[data-modal-card]');
  if (modalCard && actionTarget.classList.contains('modal-backdrop')) return;
  handleAction(actionTarget.dataset.action, actionTarget);
});

app.addEventListener('submit', (event) => {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  handleForm(form.dataset.form, form);
});

app.addEventListener('input', (event) => {
  const productInput = event.target.closest('[data-qty-product]');
  if (productInput) {
    const product = state.products.find((item) => item.id === productInput.dataset.qtyProduct);
    const max = Math.max(Number(product?.stock_quantity || 1), 1);
    state.qty[productInput.dataset.qtyProduct] = clamp(Number(productInput.value || 1), 1, max);
  }

  const cartInput = event.target.closest('[data-cart-index]');
  if (cartInput) {
    const index = Number(cartInput.dataset.cartIndex);
    if (state.cart[index]) {
      state.cart[index].quantity = Math.max(1, Number(cartInput.value || 1));
      saveCart();
      render();
    }
  }
});

async function handleAction(action, target) {
  try {
    if (action === 'auth-mode') {
      state.authMode = target.dataset.mode;
      render();
      return;
    }
    if (action === 'toggle-menu') {
      state.menuOpen = !state.menuOpen;
      render();
      return;
    }
    if (action === 'close-menu') {
      state.menuOpen = false;
      render();
      return;
    }
    if (action === 'nav') {
      state.view = target.dataset.view;
      state.menuOpen = false;
      if (state.view === 'admin' && isAdmin()) await loadAdminData();
      render();
      return;
    }
    if (action === 'logout') {
      await db.auth.signOut();
      state.cart = [];
      saveCart();
      return;
    }
    if (action === 'product-qty') return changeProductQty(target.dataset.productId, Number(target.dataset.delta));
    if (action === 'add-cart') return addToCart(target.dataset.productId);
    if (action === 'cart-qty') return changeCartQty(Number(target.dataset.index), Number(target.dataset.delta));
    if (action === 'remove-cart') return removeFromCart(Number(target.dataset.index));
    if (action === 'finalize-order') return finalizeOrder();
    if (action === 'open-pix') {
      state.modal = { type: 'pix' };
      render();
      return;
    }
    if (action === 'close-modal') {
      state.modal = null;
      render();
      return;
    }
    if (action === 'copy-pix') return copyPix();
    if (action === 'create-payment') return createPayment();
    if (action === 'confirm-delivery') return confirmDelivery(target.dataset.orderId);
    if (action === 'cancel-order') return cancelOrder(target.dataset.orderId);
    if (action === 'admin-tab') {
      state.adminTab = target.dataset.tab;
      await loadAdminData();
      render();
      return;
    }
    if (action === 'product-filter') {
      state.productFilter = target.dataset.value;
      render();
      return;
    }
    if (action === 'client-filter') {
      state.clientFilter = target.dataset.value;
      render();
      return;
    }
    if (action === 'edit-product') {
      state.editingProductId = target.dataset.productId;
      render();
      return;
    }
    if (action === 'new-product') {
      state.editingProductId = null;
      render();
      return;
    }
    if (action === 'toggle-product') return toggleProduct(target.dataset.productId);
    if (action === 'toggle-client') return toggleClient(target.dataset.clientId);
    if (action === 'mark-payment-paid') return markPaymentPaid(target.dataset.paymentId);
    if (action === 'export-pdf') return exportCyclePdf();
  } catch (error) {
    showToast(error.message || 'Não foi possível concluir.');
  }
}

async function handleForm(type, form) {
  const data = Object.fromEntries(new FormData(form).entries());
  try {
    if (type === 'login') return login(data);
    if (type === 'signup') return signup(data);
    if (type === 'profile') return saveProfile(data);
    if (type === 'product') return saveProduct(form, data);
    if (type === 'settings') return saveSettings(data);
  } catch (error) {
    showToast(error.message || 'Não foi possível salvar.');
  }
}

async function login(data) {
  const email = await emailForLogin(data.username);
  const { error } = await db.auth.signInWithPassword({ email, password: data.password });
  if (error) throw new Error('Usuário ou senha incorretos.');
  showToast('Login realizado.');
}

async function signup(data) {
  const username = normalizeUsername(data.username);
  if (username.length < 3) throw new Error('Escolha um usuário com pelo menos 3 caracteres.');

  const email = usernameEmail(username);
  const { error } = await db.auth.signUp({
    email,
    password: data.password,
    options: {
      data: {
        full_name: data.full_name,
        username,
        whatsapp: data.whatsapp
      }
    }
  });

  if (error) throw new Error('Não foi possível criar a conta. Verifique se o usuário já existe.');

  const loginAttempt = await db.auth.signInWithPassword({ email, password: data.password });
  if (loginAttempt.error) {
    state.authMode = 'login';
    render();
    showToast('Conta criada. Se o Supabase pedir confirmação, desative confirmação por e-mail no painel.');
    return;
  }

  showToast('Conta criada.');
}

async function emailForLogin(identifier) {
  const clean = normalizeUsername(identifier);
  if (!clean) throw new Error('Informe o usuário.');
  if (String(identifier || '').indexOf('@') > -1) return String(identifier).trim().toLowerCase();
  if (clean === 'admin') return ADMIN_LOGIN_EMAIL;

  const { data, error } = await db.rpc('resolve_login_identifier', { p_identifier: clean });
  if (!error && data) return data;
  return usernameEmail(clean);
}

function usernameEmail(username) {
  return `${normalizeUsername(username)}@clientes.teffexclusivo.app`;
}

async function saveProfile(data) {
  const username = normalizeUsername(data.username);
  const { error } = await db.rpc('update_my_profile', {
    p_full_name: data.full_name,
    p_username: username,
    p_whatsapp: data.whatsapp
  });
  if (error) throw error;
  await loadProfile();
  showToast('Configurações salvas.');
  render();
}

async function saveProduct(form, data) {
  const payload = {
    name: data.name.trim(),
    category: (data.category || 'Vitrine').trim(),
    description: data.description || '',
    image_url: data.image_url || null,
    price: parseNumber(data.price),
    cost: parseNumber(data.cost),
    stock_quantity: Math.max(0, parseInt(data.stock_quantity || '0', 10)),
    is_active: form.elements.is_active.checked,
    is_hidden: form.elements.is_hidden.checked
  };

  if (!payload.name) throw new Error('Informe o nome do produto.');

  if (data.id) {
    const { error } = await db.from('products').update(payload).eq('id', data.id);
    if (error) throw error;
    showToast('Produto atualizado.');
  } else {
    const { error } = await db.from('products').insert(payload);
    if (error) throw error;
    showToast('Produto criado.');
  }

  state.editingProductId = null;
  await loadProducts();
  if (isAdmin()) await loadAdminData();
  render();
}

async function saveSettings(data) {
  const payload = {
    store_name: data.store_name || 'Teff Exclusivo',
    pix_key: data.pix_key || '',
    pix_holder: data.pix_holder || '',
    payment_due_day: clamp(Number(data.payment_due_day || 7), 1, 31),
    updated_by: state.profile?.id || null
  };
  const { error } = await db.from('app_settings').update(payload).eq('id', true);
  if (error) throw error;
  await loadSettings();
  showToast('Configurações da loja salvas.');
  render();
}

function changeProductQty(productId, delta) {
  const product = state.products.find((item) => item.id === productId);
  const max = Math.max(Number(product?.stock_quantity || 1), 1);
  state.qty[productId] = clamp(productQty(productId) + delta, 1, max);
  render();
}

function addToCart(productId) {
  const product = activeProducts().find((item) => item.id === productId);
  if (!product) return;
  const stock = Number(product.stock_quantity || 0);
  const quantity = clamp(productQty(productId), 1, Math.max(stock, 1));
  const existing = state.cart.find((item) => item.product_id === product.id);

  if (existing) {
    existing.quantity = clamp(existing.quantity + quantity, 1, Math.max(stock, 1));
  } else {
    state.cart.push({
      product_id: product.id,
      name: product.name,
      price: Number(product.price || 0),
      image_url: product.image_url || '',
      quantity
    });
  }

  saveCart();
  showToast('Produto adicionado ao carrinho.');
  render();
}

function changeCartQty(index, delta) {
  if (!state.cart[index]) return;
  state.cart[index].quantity = Math.max(1, state.cart[index].quantity + delta);
  saveCart();
  render();
}

function removeFromCart(index) {
  state.cart.splice(index, 1);
  saveCart();
  render();
}

async function finalizeOrder() {
  if (!state.cart.length) return;
  const items = state.cart.map((item) => ({ product_id: item.product_id, quantity: item.quantity }));
  const { error } = await db.rpc('create_order_from_cart', { p_items: items, p_notes: '' });
  if (error) {
    if (error.message.includes('Could not find the function') || error.message.includes('create_order_from_cart')) {
      throw new Error('A segunda migration do checkout ainda precisa ser aplicada no Supabase.');
    }
    throw error;
  }
  state.cart = [];
  saveCart();
  await refreshAll();
  state.view = 'orders';
  showToast('Pedido finalizado.');
  render();
}

async function createPayment() {
  const { error } = await db.rpc('create_pix_payment_for_my_balance');
  if (error) throw error;
  state.modal = null;
  await refreshAll();
  showToast('Pagamento registrado. Envie o Pix e aguarde confirmação.');
  render();
}

async function copyPix() {
  const key = state.settings?.pix_key || '';
  if (!key) throw new Error('Chave Pix ainda não cadastrada.');
  await navigator.clipboard.writeText(key);
  showToast('Chave Pix copiada.');
}

async function confirmDelivery(orderId) {
  const { error } = await db.rpc('confirm_delivery', { p_order_id: orderId });
  if (error) throw error;
  await refreshAll();
  showToast('Entrega confirmada.');
  render();
}

async function cancelOrder(orderId) {
  if (!window.confirm('Cancelar este pedido e devolver o estoque?')) return;
  const { error } = await db.rpc('cancel_order', { p_order_id: orderId, p_reason: 'Cancelado pela cliente' });
  if (error) throw error;
  await refreshAll();
  showToast('Pedido cancelado e estoque devolvido.');
  render();
}

async function toggleProduct(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;
  const hidden = product.is_hidden || !product.is_active;
  const { error } = await db.from('products').update({ is_hidden: !hidden, is_active: true }).eq('id', productId);
  if (error) throw error;
  await loadProducts();
  await loadAdminData();
  showToast(hidden ? 'Produto ativado.' : 'Produto ocultado.');
  render();
}

async function toggleClient(clientId) {
  const profile = state.adminProfiles.find((item) => item.id === clientId);
  if (!profile) return;
  const { error } = await db.from('profiles').update({ is_active: !profile.is_active }).eq('id', clientId);
  if (error) throw error;
  await loadAdminData();
  showToast(profile.is_active ? 'Cliente ocultado.' : 'Cliente reativado.');
  render();
}

async function markPaymentPaid(paymentId) {
  const payment = state.adminPayments.find((item) => item.id === paymentId);
  if (!payment) return;
  const now = new Date().toISOString();
  const { error } = await db.from('payments').update({ status: 'PAGO', paid_at: now }).eq('id', paymentId);
  if (error) throw error;

  const links = state.adminPaymentOrders.filter((item) => item.payment_id === paymentId);
  const orderIds = links.map((item) => item.order_id);
  if (orderIds.length) {
    const { error: orderError } = await db
      .from('orders')
      .update({ payment_status: 'PAGO', status: 'PAGO', paid_at: now })
      .in('id', orderIds);
    if (orderError) throw orderError;
  }

  await refreshAll();
  showToast('Pagamento marcado como pago.');
  render();
}

function exportCyclePdf() {
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) throw new Error('Gerador de PDF ainda não carregou.');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const orders = ordersThisMonth(state.adminOrders);
  const payments = state.adminPayments.filter((payment) => isThisMonth(payment.created_at));
  let y = 52;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Teff Exclusivo - Fechamento do ciclo', 40, y);
  y += 24;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Gerado em ${dateFmt.format(new Date())}`, 40, y);
  y += 26;

  const total = orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const profit = orders.reduce((sum, order) => sum + Number(order.profit_amount || 0), 0);
  doc.setFont('helvetica', 'bold');
  doc.text(`Pedidos: ${orders.length}   Total: ${formatMoney(total)}   Lucro: ${formatMoney(profit)}`, 40, y);
  y += 24;

  doc.text('Pedidos', 40, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  for (const order of orders) {
    if (y > 760) { doc.addPage(); y = 48; }
    const customer = state.adminProfiles.find((profile) => profile.id === order.customer_id);
    const items = itemsForOrder(order.id, state.adminOrderItems).map((item) => `${item.quantity}x ${item.product_name}`).join(', ');
    doc.text(`${order.order_code || 'Pedido'} - ${customer?.full_name || customer?.username || 'Cliente'} - ${formatMoney(order.total_amount)} - ${order.payment_status}`, 40, y);
    y += 14;
    doc.setTextColor(110, 91, 86);
    doc.text(doc.splitTextToSize(items || 'Sem itens', 510), 52, y);
    doc.setTextColor(0, 0, 0);
    y += 24;
  }

  y += 8;
  if (y > 730) { doc.addPage(); y = 48; }
  doc.setFont('helvetica', 'bold');
  doc.text('Pagamentos', 40, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  for (const payment of payments) {
    if (y > 760) { doc.addPage(); y = 48; }
    const customer = state.adminProfiles.find((profile) => profile.id === payment.customer_id);
    doc.text(`${customer?.full_name || customer?.username || 'Cliente'} - ${formatMoney(payment.amount)} - ${payment.status} - ${formatDate(payment.created_at)}`, 40, y);
    y += 16;
  }

  doc.save(`teff-fechamento-${new Date().toISOString().slice(0, 7)}.pdf`);
}

function activeProducts() {
  return state.products.filter((product) => product.is_active && !product.is_hidden);
}

function filterAdminProducts() {
  if (state.productFilter === 'ativos') return state.products.filter((product) => product.is_active && !product.is_hidden);
  if (state.productFilter === 'ocultos') return state.products.filter((product) => !product.is_active || product.is_hidden);
  return state.products;
}

function filterAdminClients() {
  if (state.clientFilter === 'ativos') return state.adminProfiles.filter((profile) => profile.is_active);
  if (state.clientFilter === 'ocultos') return state.adminProfiles.filter((profile) => !profile.is_active);
  return state.adminProfiles;
}

function pendingDebt() {
  return state.myOrders
    .filter((order) => ['CONFIRMADO', 'ENTREGUE'].includes(order.status) && order.payment_status === 'PENDENTE')
    .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
}

function cartTotal() {
  return state.cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
}

function cartCount() {
  return state.cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function productQty(productId) {
  return state.qty[productId] || 1;
}

function itemsForOrder(orderId, items) {
  return items.filter((item) => item.order_id === orderId);
}

function ordersThisMonth(orders) {
  return orders.filter((order) => isThisMonth(order.created_at));
}

function isThisMonth(value) {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function isAdmin() {
  return state.profile?.role === 'admin';
}

function displayName() {
  return state.profile?.full_name || state.profile?.username || 'Cliente';
}

function statusBadge(status, paymentStatus) {
  if (status === 'CANCELADO') return '<span class="status bad">CANCELADO</span>';
  if (paymentStatus === 'PAGO' || status === 'PAGO') return '<span class="status ok">PAGO</span>';
  if (status === 'ENTREGUE') return '<span class="status ok">ENTREGUE</span>';
  return `<span class="status">${escapeHtml(status || 'CONFIRMADO')}</span>`;
}

function formatMoney(value) {
  return money.format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return '';
  return dateFmt.format(new Date(value));
}

function parseNumber(value) {
  if (typeof value !== 'string') return Number(value || 0);
  return Number(value.replace(/\./g, '').replace(',', '.')) || 0;
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value) || min, min), max);
}

function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]/g, '');
}

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem('teff_exclusivo_cart') || '[]');
  } catch (_error) {
    return [];
  }
}

function saveCart() {
  localStorage.setItem('teff_exclusivo_cart', JSON.stringify(state.cart));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toastEl.classList.remove('show'), 3600);
}
