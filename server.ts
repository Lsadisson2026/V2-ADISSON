import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { addMonths, differenceInDays, format, isAfter, isBefore, startOfDay } from 'date-fns';

dotenv.config();

const app = express();
const PORT = 3000;
const db = new Database('finance.db');
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// --- Schema Migration (Drop old tables if they don't match new schema) ---
try {
  const tableInfo = db.prepare("PRAGMA table_info(interest_cycles)").all();
  const hasTotalDue = tableInfo.some((col: any) => col.name === 'total_due');
  if (hasTotalDue) {
    console.log('Old schema detected, dropping tables for refactor...');
    db.exec(`
      DROP TABLE IF EXISTS payments;
      DROP TABLE IF EXISTS interest_cycles;
      DROP TABLE IF EXISTS contracts;
    `);
  }
} catch (e) {
  // Table might not exist yet, that's fine
}

// --- Database Initialization ---
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    login TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT CHECK(role IN ('ADMIN', 'COLLECTOR')) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration for existing users table
try {
  db.prepare('ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP').run();
} catch (e) {
  // Column already exists
}

db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    cpf TEXT,
    address TEXT,
    phone TEXT,
    notes TEXT,
    status TEXT CHECK(status IN ('ACTIVE', 'BLOCKED', 'PENDING')) DEFAULT 'ACTIVE'
  );
`);

// Migration for existing clients table
try {
  const info = db.prepare("PRAGMA table_info(clients)").all();
  const columns = info.map((col: any) => col.name);
  if (!columns.includes('cpf')) db.exec("ALTER TABLE clients ADD COLUMN cpf TEXT;");
  if (!columns.includes('address')) db.exec("ALTER TABLE clients ADD COLUMN address TEXT;");
} catch (e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    capital REAL NOT NULL,
    interest_rate_monthly REAL NOT NULL,
    monthly_interest_amount REAL NOT NULL,
    next_due_date TEXT NOT NULL,
    status TEXT CHECK(status IN ('ACTIVE', 'CLOSED')) DEFAULT 'ACTIVE',
    guarantee_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id)
  );

  CREATE TABLE IF NOT EXISTS interest_cycles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER NOT NULL,
    due_date TEXT NOT NULL,
    base_interest_amount REAL NOT NULL,
    paid_amount REAL DEFAULT 0,
    status TEXT CHECK(status IN ('PENDING', 'PAID', 'OVERDUE')) DEFAULT 'PENDING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts(id)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER NOT NULL,
    interest_cycle_id INTEGER,
    amount REAL NOT NULL,
    payment_type TEXT CHECK(payment_type IN ('INTEREST', 'CAPITAL', 'PARTIAL', 'ADVANCE_INTEREST')) NOT NULL,
    payment_method TEXT CHECK(payment_method IN ('PIX', 'CASH')) NOT NULL,
    received_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts(id),
    FOREIGN KEY (interest_cycle_id) REFERENCES interest_cycles(id),
    FOREIGN KEY (received_by) REFERENCES users(id)
  );
`);

// Migration for payments table
try {
  const info = db.prepare("PRAGMA table_info(payments)").all();
  const columns = info.map((col: any) => col.name);
  if (!columns.includes('received_by')) db.exec("ALTER TABLE payments ADD COLUMN received_by INTEGER REFERENCES users(id);");
} catch (e) {}

// Create default admin if not exists
const adminExists = db.prepare('SELECT id FROM users WHERE login = ?').get('admin');
if (!adminExists) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (name, login, password_hash, role) VALUES (?, ?, ?, ?)').run('Administrador', 'admin', hash, 'ADMIN');
}

// --- Middleware ---
app.use(cors());
app.use(express.json());

// Auth Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

const isAdmin = (req: any, res: any, next: any) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Acesso negado' });
  next();
};

// --- Helper Functions ---

// No automatic late fee updates anymore as per new requirements.
// We just check if the date is passed in the query.

// --- API Routes ---

// Auth
app.post('/api/login', (req, res) => {
  const { login, password } = req.body;
  // Force lowercase for login to ensure case-insensitivity
  const normalizedLogin = login.toLowerCase();
  const user: any = db.prepare('SELECT * FROM users WHERE lower(login) = ?').get(normalizedLogin);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET);
  res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
});

app.post('/api/register', authenticateToken, isAdmin, (req, res) => {
  const { name, login, password, role } = req.body;
  
  if (!['ADMIN', 'COLLECTOR'].includes(role)) {
    return res.status(400).json({ error: 'Role inválido' });
  }

  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    // Ensure login is stored in lowercase
    const normalizedLogin = login.toLowerCase();
    const result = db.prepare('INSERT INTO users (name, login, password_hash, role) VALUES (?, ?, ?, ?)').run(name, normalizedLogin, hashedPassword, role);
    res.json({ id: result.lastInsertRowid });
  } catch (error: any) {
    res.status(400).json({ error: 'Erro ao registrar usuário. Login pode já existir.' });
  }
});

// Users Management
app.get('/api/users', authenticateToken, isAdmin, (req, res) => {
  const users = db.prepare('SELECT id, name, login, role, created_at FROM users ORDER BY name ASC').all();
  res.json(users);
});

app.post('/api/users/:id/reset-password', authenticateToken, isAdmin, (req, res) => {
  const { password } = req.body;
  const userId = req.params.id;
  
  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashedPassword, userId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao resetar senha.' });
  }
});

app.delete('/api/users/:id', authenticateToken, isAdmin, (req, res) => {
  const userId = req.params.id;
  if (userId == (req as any).user.id) {
    return res.status(400).json({ error: 'Não é possível excluir o próprio usuário.' });
  }
  
  try {
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao excluir usuário.' });
  }
});

// Clients
app.get('/api/clients', authenticateToken, (req, res) => {
  const { search } = req.query;
  if (search) {
    const clients = db.prepare(`
      SELECT * FROM clients 
      WHERE name LIKE ? OR cpf LIKE ? 
      ORDER BY name ASC
    `).all(`%${search}%`, `%${search}%`);
    return res.json(clients);
  }
  const clients = db.prepare('SELECT * FROM clients ORDER BY name ASC').all();
  res.json(clients);
});

app.patch('/api/clients/:id', authenticateToken, isAdmin, (req, res) => {
  try {
    const { name, cpf, address, phone, notes } = req.body;
    db.prepare(`
      UPDATE clients 
      SET name = ?, cpf = ?, address = ?, phone = ?, notes = ?
      WHERE id = ?
    `).run(name, cpf, address, phone, notes, req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao atualizar cliente:', error);
    res.status(500).json({ error: error.message || 'Erro interno do servidor' });
  }
});

app.delete('/api/clients/:id', authenticateToken, isAdmin, (req, res) => {
  const clientId = req.params.id;
  try {
    db.transaction(() => {
      // 1. Get all contract IDs for this client
      const contracts = db.prepare('SELECT id FROM contracts WHERE client_id = ?').all(clientId);
      const contractIds = contracts.map((c: any) => c.id);

      if (contractIds.length > 0) {
        const placeholders = contractIds.map(() => '?').join(',');
        
        // 2. Delete payments linked to these contracts
        db.prepare(`DELETE FROM payments WHERE contract_id IN (${placeholders})`).run(...contractIds);

        // 3. Delete interest cycles linked to these contracts
        db.prepare(`DELETE FROM interest_cycles WHERE contract_id IN (${placeholders})`).run(...contractIds);

        // 4. Delete the contracts
        db.prepare(`DELETE FROM contracts WHERE id IN (${placeholders})`).run(...contractIds);
      }

      // 5. Delete the client
      db.prepare('DELETE FROM clients WHERE id = ?').run(clientId);
    })();
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao excluir cliente:', error);
    res.status(500).json({ error: error.message || 'Erro interno do servidor' });
  }
});

app.get('/api/clients/:id/details', authenticateToken, (req, res) => {
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

  const contracts = db.prepare(`
    SELECT c.*, 
      (SELECT COUNT(*) FROM interest_cycles WHERE contract_id = c.id AND status = 'OVERDUE') as overdue_count
    FROM contracts c 
    WHERE client_id = ? 
    ORDER BY created_at DESC
  `).all(req.params.id);

  const interestCycles = db.prepare(`
    SELECT ic.*, c.capital
    FROM interest_cycles ic
    JOIN contracts c ON ic.contract_id = c.id
    WHERE c.client_id = ? AND ic.status != 'PAID'
    ORDER BY ic.due_date ASC
  `).all(req.params.id);

  res.json({ client, contracts, interestCycles });
});

app.post('/api/clients', authenticateToken, (req, res) => {
  try {
    const { name, cpf, address, phone, notes } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }
    const result = db.prepare('INSERT INTO clients (name, cpf, address, phone, notes) VALUES (?, ?, ?, ?, ?)').run(name, cpf, address, phone, notes);
    res.json({ id: result.lastInsertRowid });
  } catch (error: any) {
    console.error('Erro ao cadastrar cliente:', error);
    res.status(500).json({ error: error.message || 'Erro interno do servidor' });
  }
});

app.post('/api/clients/:id/renegotiate', authenticateToken, isAdmin, (req, res) => {
  const clientId = req.params.id;
  const { contractIds, newCapital, newRate, nextDueDate, guaranteeNotes, interestOnly } = req.body;

  try {
    db.transaction(() => {
      const placeholders = contractIds.map(() => '?').join(',');

      if (interestOnly) {
        // Mark pending interest cycles as PAID for selected contracts
        // We assume the new contract covers these debts
        db.prepare(`
          UPDATE interest_cycles 
          SET status = 'PAID', paid_amount = base_interest_amount 
          WHERE contract_id IN (${placeholders}) AND status != 'PAID'
        `).run(...contractIds);
      } else {
        // 1. Close old contracts
        db.prepare(`UPDATE contracts SET status = 'CLOSED' WHERE id IN (${placeholders}) AND client_id = ?`)
          .run(...contractIds, clientId);
      }

      // 2. Create new consolidated contract (or interest-only contract)
      const monthlyInterest = newCapital * (newRate / 100);
      const result = db.prepare(`
        INSERT INTO contracts (client_id, capital, interest_rate_monthly, monthly_interest_amount, next_due_date, guarantee_notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(clientId, newCapital, newRate / 100, monthlyInterest, nextDueDate, guaranteeNotes);

      const newContractId = result.lastInsertRowid;

      // 3. Create first cycle
      db.prepare(`
        INSERT INTO interest_cycles (contract_id, due_date, base_interest_amount)
        VALUES (?, ?, ?)
      `).run(newContractId, nextDueDate, monthlyInterest);
    })();

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Contracts
app.get('/api/contracts', authenticateToken, (req, res) => {
  const { status } = req.query;
  let query = `
    SELECT c.*, cl.name as client_name, cl.phone as client_phone 
    FROM contracts c 
    JOIN clients cl ON c.client_id = cl.id
  `;
  const params = [];
  if (status) {
    query += ' WHERE c.status = ?';
    params.push(status);
  }
  query += ' ORDER BY c.created_at DESC';
  
  const contracts = db.prepare(query).all(...params);
  
  // For collectors, hide capital and rate
  if ((req as any).user.role === 'COLLECTOR') {
    contracts.forEach((c: any) => {
      delete c.capital;
      delete c.interest_rate_monthly;
    });
  }
  
  res.json(contracts);
});

app.post('/api/contracts', authenticateToken, isAdmin, (req, res) => {
  try {
    const { client_id, capital, interest_rate_monthly, next_due_date, guarantee_notes } = req.body;
    
    if (!client_id || capital === undefined || interest_rate_monthly === undefined || !next_due_date) {
      return res.status(400).json({ error: 'Dados obrigatórios ausentes' });
    }

    const monthly_interest_amount = capital * interest_rate_monthly;
    
    const result = db.prepare(`
      INSERT INTO contracts (client_id, capital, interest_rate_monthly, monthly_interest_amount, next_due_date, guarantee_notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(client_id, capital, interest_rate_monthly, monthly_interest_amount, next_due_date, guarantee_notes);
    
    const contractId = result.lastInsertRowid;
    
    // Create first interest cycle
    db.prepare(`
      INSERT INTO interest_cycles (contract_id, due_date, base_interest_amount)
      VALUES (?, ?, ?)
    `).run(contractId, next_due_date, monthly_interest_amount);
    
    res.json({ id: contractId });
  } catch (error: any) {
    console.error('Error creating contract:', error);
    res.status(500).json({ error: error.message || 'Erro interno ao criar contrato' });
  }
});

app.patch('/api/contracts/:id', authenticateToken, isAdmin, (req, res) => {
  const { id } = req.params;
  const { capital, interest_rate_monthly, status, guarantee_notes } = req.body;
  
  const contract: any = db.prepare('SELECT * FROM contracts WHERE id = ?').get(id);
  if (!contract) return res.status(404).json({ error: 'Contrato não encontrado' });

  const newCapital = capital !== undefined ? capital : contract.capital;
  const newRate = interest_rate_monthly !== undefined ? interest_rate_monthly : contract.interest_rate_monthly;
  const newMonthlyInterest = newCapital * newRate;

  db.prepare(`
    UPDATE contracts 
    SET capital = ?, interest_rate_monthly = ?, monthly_interest_amount = ?, status = ?, guarantee_notes = ?
    WHERE id = ?
  `).run(newCapital, newRate, newMonthlyInterest, status || contract.status, guarantee_notes || contract.guarantee_notes, id);

  res.json({ success: true });
});

// Interest Cycles
app.get('/api/cycles', authenticateToken, (req, res) => {
  const { date, status, contract_id } = req.query;
  let query = `
    SELECT ic.*, cl.name as client_name, cl.phone as client_phone, c.guarantee_notes
    FROM interest_cycles ic
    JOIN contracts c ON ic.contract_id = c.id
    JOIN clients cl ON c.client_id = cl.id
  `;
  const params = [];
  const conditions = [];

  if (date) {
    conditions.push('ic.due_date = ?');
    params.push(date);
  }
  if (status) {
    conditions.push('ic.status = ?');
    params.push(status);
  }
  if (contract_id) {
    conditions.push('ic.contract_id = ?');
    params.push(contract_id);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY ic.due_date ASC';
  
  const cycles = db.prepare(query).all(...params);
  res.json(cycles);
});

// Dashboard Data
app.get('/api/dashboard', authenticateToken, (req, res) => {
  const today = format(new Date(), 'yyyy-MM-dd');
  
  // ATRASADOS: Vencidos antes de hoje
  const overdueCycles = db.prepare(`
    SELECT ic.*, cl.name as client_name, cl.phone as client_phone, c.capital
    FROM interest_cycles ic
    JOIN contracts c ON ic.contract_id = c.id
    JOIN clients cl ON c.client_id = cl.id
    WHERE ic.due_date < ? AND ic.status != 'PAID'
    ORDER BY ic.due_date ASC
  `).all(today);

  // HOJE: Vencem hoje
  const todayCycles = db.prepare(`
    SELECT ic.*, cl.name as client_name, cl.phone as client_phone, c.capital
    FROM interest_cycles ic
    JOIN contracts c ON ic.contract_id = c.id
    JOIN clients cl ON c.client_id = cl.id
    WHERE ic.due_date = ? AND ic.status != 'PAID'
    ORDER BY ic.due_date ASC
  `).all(today);

  // PROGRAMADOS: Juros futuros
  const scheduledCycles = db.prepare(`
    SELECT ic.*, cl.name as client_name, cl.phone as client_phone, c.capital
    FROM interest_cycles ic
    JOIN contracts c ON ic.contract_id = c.id
    JOIN clients cl ON c.client_id = cl.id
    WHERE ic.due_date > ? AND ic.status = 'PENDING'
    ORDER BY ic.due_date ASC
  `).all(today);

  const allActive = db.prepare(`
    SELECT c.*, cl.name as client_name
    FROM contracts c
    JOIN clients cl ON c.client_id = cl.id
    WHERE c.status = 'ACTIVE'
  `).all();

  const completed = db.prepare(`
    SELECT c.*, cl.name as client_name
    FROM contracts c
    JOIN clients cl ON c.client_id = cl.id
    WHERE c.status = 'CLOSED'
  `).all();

  // FINANCIAL METRICS
  const metrics = db.prepare(`
    SELECT 
      (SELECT SUM(capital) FROM contracts WHERE status = 'ACTIVE') as total_on_street,
      (SELECT SUM(amount) FROM payments WHERE payment_type IN ('INTEREST', 'ADVANCE_INTEREST', 'PARTIAL')) as total_interest_received,
      (SELECT SUM(base_interest_amount - paid_amount) FROM interest_cycles WHERE status != 'PAID') as total_interest_to_receive,
      (SELECT COUNT(*) FROM contracts WHERE status = 'ACTIVE') as total_active_contracts
  `).get();

  // RECENT PAYMENTS GROUPED BY CLIENT
  const recentPaymentsRaw = db.prepare(`
    SELECT p.*, cl.name as client_name, cl.id as client_id
    FROM payments p
    JOIN contracts c ON p.contract_id = c.id
    JOIN clients cl ON c.client_id = cl.id
    ORDER BY p.created_at DESC
    LIMIT 50
  `).all();

  const groupedPayments: any[] = [];
  const clientMap = new Map();

  recentPaymentsRaw.forEach((p: any) => {
    if (!clientMap.has(p.client_id)) {
      const entry = {
        client_id: p.client_id,
        client_name: p.client_name,
        total_amount: 0,
        payments: []
      };
      clientMap.set(p.client_id, entry);
      groupedPayments.push(entry);
    }
    const clientEntry = clientMap.get(p.client_id);
    clientEntry.payments.push(p);
    clientEntry.total_amount += p.amount;
  });

  // Role based filtering
  if ((req as any).user.role === 'COLLECTOR') {
    [allActive, completed].forEach(list => list.forEach((c: any) => {
      delete c.capital;
      delete c.interest_rate_monthly;
    }));
  }

  // Detailed lists for metrics
  const interestReceivedList = db.prepare(`
    SELECT p.*, cl.name as client_name, cl.id as client_id
    FROM payments p
    JOIN contracts c ON p.contract_id = c.id
    JOIN clients cl ON c.client_id = cl.id
    WHERE p.payment_type IN ('INTEREST', 'ADVANCE_INTEREST', 'PARTIAL')
    ORDER BY p.created_at DESC
  `).all();

  const interestToReceiveList = db.prepare(`
    SELECT ic.*, cl.name as client_name, cl.id as client_id, c.capital
    FROM interest_cycles ic
    JOIN contracts c ON ic.contract_id = c.id
    JOIN clients cl ON c.client_id = cl.id
    WHERE ic.status != 'PAID'
    ORDER BY ic.due_date ASC
  `).all();

  res.json({
    overdue: overdueCycles,
    today: todayCycles,
    scheduled: scheduledCycles,
    all: allActive,
    completed: completed,
    metrics: {
      total_on_street: metrics.total_on_street || 0,
      total_interest_received: metrics.total_interest_received || 0,
      total_interest_to_receive: metrics.total_interest_to_receive || 0,
      total_active_contracts: metrics.total_active_contracts || 0
    },
    details: {
      interestReceived: interestReceivedList,
      interestToReceive: interestToReceiveList
    },
    recent_payments: groupedPayments.slice(0, 10)
  });
});

// Payments
app.post('/api/payments', authenticateToken, (req, res) => {
  try {
    const { contract_id, interest_cycle_id, amount, payment_type, payment_method, next_due_date } = req.body;
    
    const contract: any = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contract_id);
    if (!contract) return res.status(404).json({ error: 'Contrato não encontrado' });
    
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Valor do pagamento inválido' });
    }

    db.transaction(() => {
      // Record payment
      db.prepare(`
        INSERT INTO payments (contract_id, interest_cycle_id, amount, payment_type, payment_method, received_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(contract_id, interest_cycle_id, amount, payment_type, payment_method, (req as any).user.id);

      if (payment_type === 'CAPITAL') {
        if (amount >= contract.capital) {
          db.prepare("UPDATE contracts SET status = 'CLOSED' WHERE id = ?").run(contract_id);
          db.prepare("UPDATE interest_cycles SET status = 'PAID' WHERE contract_id = ? AND status != 'PAID'").run(contract_id);
        } else {
          const newCapital = contract.capital - amount;
          const newMonthlyInterest = newCapital * contract.interest_rate_monthly;
          db.prepare("UPDATE contracts SET capital = ?, monthly_interest_amount = ? WHERE id = ?")
            .run(newCapital, newMonthlyInterest, contract_id);
        }
      } else if (interest_cycle_id) {
        // Interest payment
        if (payment_type === 'PARTIAL') {
          db.prepare("UPDATE interest_cycles SET paid_amount = paid_amount + ? WHERE id = ?").run(amount, interest_cycle_id);
          
          const updatedCycle: any = db.prepare("SELECT * FROM interest_cycles WHERE id = ?").get(interest_cycle_id);
          if (updatedCycle.paid_amount >= updatedCycle.base_interest_amount - 0.01) { // Tolerance for float
             db.prepare("UPDATE interest_cycles SET status = 'PAID' WHERE id = ?").run(interest_cycle_id);
          }
        } else {
          // Full interest payment or Advance
          db.prepare("UPDATE interest_cycles SET paid_amount = base_interest_amount, status = 'PAID' WHERE id = ?")
            .run(interest_cycle_id);
        }
        
        // If next_due_date is provided, create next cycle (only if fully paid or explicitly requested?)
        // Usually next cycle is created when current is paid.
        // But here we rely on next_due_date being passed.
        if (next_due_date && contract.status === 'ACTIVE' && (payment_type !== 'PARTIAL' || amount >= contract.monthly_interest_amount)) {
          db.prepare(`
            INSERT INTO interest_cycles (contract_id, due_date, base_interest_amount)
            VALUES (?, ?, ?)
          `).run(contract_id, next_due_date, contract.monthly_interest_amount);
          
          db.prepare("UPDATE contracts SET next_due_date = ? WHERE id = ?").run(next_due_date, contract_id);
        }
      }
    })();

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error processing payment:', error);
    res.status(500).json({ error: error.message || 'Erro interno ao processar pagamento' });
  }
});

// Reports
app.get('/api/reports', authenticateToken, (req, res) => {
  const { start_date, end_date } = req.query;
  
  // Check if user is admin or collector
  if (!['ADMIN', 'COLLECTOR'].includes((req as any).user.role)) {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  
  let paymentQuery = `
    SELECT p.*, cl.name as client_name, c.client_id
    FROM payments p
    JOIN contracts c ON p.contract_id = c.id
    JOIN clients cl ON c.client_id = cl.id
  `;
  
  let params: any[] = [];

  if (start_date && end_date) {
    paymentQuery += ' WHERE p.created_at BETWEEN ? AND ?';
    params.push(`${start_date} 00:00:00`, `${end_date} 23:59:59`);
  }

  paymentQuery += ' ORDER BY p.created_at DESC';

  const allPayments = db.prepare(paymentQuery).all(...params);
  
  const totalReceived = allPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
  const interestReceived = allPayments
    .filter((p: any) => ['INTEREST', 'PARTIAL', 'ADVANCE_INTEREST'].includes(p.payment_type))
    .reduce((sum: number, p: any) => sum + p.amount, 0);
  
  const activeContractsList = db.prepare(`
    SELECT c.*, cl.name as client_name 
    FROM contracts c
    JOIN clients cl ON c.client_id = cl.id
    WHERE c.status = 'ACTIVE'
    ORDER BY cl.name ASC
  `).all();

  const overdueContractsList = db.prepare(`
    SELECT DISTINCT c.*, cl.name as client_name, ic.due_date as overdue_since, ic.base_interest_amount
    FROM interest_cycles ic
    JOIN contracts c ON ic.contract_id = c.id
    JOIN clients cl ON c.client_id = cl.id
    WHERE ic.due_date < date('now') AND ic.status != 'PAID'
    ORDER BY ic.due_date ASC
  `).all();

  // Group recent payments for the existing view
  const recentPaymentsRaw = allPayments.slice(0, 50);
  const groupedPayments: any[] = [];
  const clientMap = new Map();

  recentPaymentsRaw.forEach((p: any) => {
    if (!clientMap.has(p.client_id)) {
      const entry = {
        client_id: p.client_id,
        client_name: p.client_name,
        total_amount: 0,
        payments: []
      };
      clientMap.set(p.client_id, entry);
      groupedPayments.push(entry);
    }
    const clientEntry = clientMap.get(p.client_id);
    clientEntry.payments.push(p);
    clientEntry.total_amount += p.amount;
  });

  res.json({
    totalReceived,
    interestReceived,
    activeContracts: activeContractsList.length,
    overdueContracts: overdueContractsList.length,
    recentPayments: groupedPayments,
    details: {
      payments: allPayments,
      activeContracts: activeContractsList,
      overdueContracts: overdueContractsList
    }
  });
});


// --- Vite Setup ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
