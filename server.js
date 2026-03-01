const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// ========================================
// BREEDCLAW PRODUCTION ORCHESTRATOR v1.0.5
// Render.com Optimized - Full Frontend + Backend
// ========================================

// MIDDLEWARE
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : '*',
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'frontend/build'), { 
  maxAge: '1y',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) res.set('Cache-Control', 'public, immutable');
  }
}));

// CONFIG
const API_KEY = process.env.API_KEY || "dev-key-123";
const BREEDING_FEE = 100.00;
const SEED_COST = 10.00;

// ========================================
// STATE ENGINE (Production-ready In-Memory)
// ========================================
let agents = [
  { 
    id: 'bc-001', rootName: 'zap-001', stage: 'living', confidence: 0.92, 
    win_rate: 0.68, profit_factor: 1.8, sharpe: 1.45, walletBalance: 245.50,
    parent_id: null, hasPendingLoan: false, params: { lookback: 14, risk: 0.02 }
  },
  { 
    id: 'bc-002', rootName: 'vibe-001s', stage: 'seeded', confidence: 0.87, 
    win_rate: 0.58, profit_factor: 1.4, sharpe: 1.12, walletBalance: 45.20,
    parent_id: null, hasPendingLoan: false, params: { lookback: 12, risk: 0.025 }
  },
  { 
    id: 'bc-003', rootName: null, stage: 'demo', confidence: 0.76, 
    win_rate: 0.52, profit_factor: 1.2, sharpe: 0.95, walletBalance: 0.00,
    parent_id: null, hasPendingLoan: false, params: { lookback: 10, risk: 0.03 }
  }
];

let loans = [
  { id: 'lr-001', agentId: 'bc-002', agentName: 'vibe-001s', amount: 50.00, status: 'pending' }
];

let reserve = {
  balance: 15420.50,
  address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  network: 'Base Mainnet',
  transactions: [
    { type: 'INITIAL_DEPOSIT', hash: '0x9a8b7c6d', amount: 15420.50, timestamp: Date.now() }
  ]
};

let queueStats = {
  "Provisioning": { waiting: 0, active: 0, completed: 12, failed: 0 },
  "Breeding": { waiting: 0, active: 0, completed: 5, failed: 0 }
};

// ========================================
// AUTH SHIELD
// ========================================
const validateKey = (req, res, next) => {
  const key = req.headers['x-api-key'];
  if (!key || key !== API_KEY) {
    return res.status(401).json({ error: "Access Denied: Invalid Security Token" });
  }
  next();
};

// ========================================
// SYSTEM ROUTES
// ========================================
app.get('/health', (req, res) => res.status(200).json({ status: 'OK', timestamp: Date.now() }));

// ========================================
// AGENTS API (React expects camelCase)
// ========================================
app.get('/api/agents', (req, res) => {
  const { stage, q } = req.query;
  let filtered = agents;
  
  if (stage && stage !== 'all') {
    filtered = filtered.filter(a => a.stage === stage);
  }
  if (q) {
    filtered = filtered.filter(a => 
      a.rootName?.toLowerCase().includes(q.toLowerCase()) || 
      a.id.toLowerCase().includes(q.toLowerCase())
    );
  }
  
  res.json(filtered);
});

app.post('/api/agents', validateKey, (req, res) => {
  queueStats["Provisioning"].waiting++;
  
  setTimeout(() => {
    const id = `bc-${Math.floor(Math.random() * 9000) + 1000}`;
    const newAgent = {
      id,
      rootName: null,
      stage: 'demo',
      confidence: 0.1 + Math.random() * 0.3,
      win_rate: 0.45 + Math.random() * 0.2,
      profit_factor: 1.0 + Math.random() * 0.8,
      sharpe: 0.5 + Math.random() * 0.8,
      walletBalance: 0.00,
      parent_id: null,
      hasPendingLoan: false,
      params: { lookback: 14 + Math.floor(Math.random() * 10), risk: 0.02 }
    };
    agents.push(newAgent);
    queueStats["Provisioning"].waiting--;
    queueStats["Provisioning"].completed++;
  }, 2000); // Faster for demo

  res.status(202).json({ status: "Enqueued", job: "spawn_agent" });
});

app.post('/api/agents/:id/seed', validateKey, (req, res) => {
  const agent = agents.find(a => a.id === req.params.id);
  if (!agent) return res.status(404).json({ error: "Agent Not Found" });
  
  if (agent.confidence < 0.9) {
    return res.status(400).json({ error: "Confidence too low for seeding" });
  }
  if (parseFloat(reserve.balance) < SEED_COST) {
    return res.status(400).json({ error: "Insufficient reserve funds" });
  }

  agent.stage = 'seeded';
  agent.rootName = `agent-${agent.id.slice(-3)}-001s`;
  agent.walletBalance = SEED_COST;
  
  reserve.balance = (parseFloat(reserve.balance) - SEED_COST).toFixed(2);
  reserve.transactions.unshift({
    type: 'SEED_TX',
    hash: `0x${uuidv4().replace(/-/g, '').substring(0, 16)}`,
    amount: SEED_COST,
    timestamp: Date.now()
  });

  res.json({ success: true, agent, reserve });
});

app.post('/api/agents/:id/breed', validateKey, (req, res) => {
  const agent = agents.find(a => a.id === req.params.id);
  if (!agent) return res.status(404).json({ error: "Agent Not Found" });
  
  if (agent.stage !== 'living') {
    return res.status(400).json({ error: "Only living agents can breed" });
  }
  if (parseFloat(agent.walletBalance) < BREEDING_FEE) {
    return res.status(400).json({ error: "Insufficient breeding fee" });
  }

  // Deduct fee from parent
  agent.walletBalance = (parseFloat(agent.walletBalance) - BREEDING_FEE).toFixed(2);
  
  // Credit reserve
  reserve.balance = (parseFloat(reserve.balance) + BREEDING_FEE).toFixed(2);
  
  // Create offspring
  const offspringId = `bc-${Math.floor(Math.random() * 9000) + 1000}`;
  const offspring = {
    id: offspringId,
    rootName: null,
    stage: 'demo',
    confidence: 0.65 + Math.random() * 0.2, // Inherits some parent quality
    win_rate: agent.win_rate * (0.9 + Math.random() * 0.2),
    profit_factor: agent.profit_factor * (0.9 + Math.random() * 0.2),
    sharpe: agent.sharpe * (0.9 + Math.random() * 0.2),
    walletBalance: 0.00,
    parent_id: agent.id,
    hasPendingLoan: false,
    params: {
      ...agent.params,
      lookback: Math.max(3, Math.min(20, agent.params.lookback + (Math.random() - 0.5) * 4)),
      risk: Math.max(0.01, Math.min(0.05, agent.params.risk + (Math.random() - 0.5) * 0.01))
    }
  };
  
  agents.push(offspring);
  
  // Log transaction
  reserve.transactions.unshift({
    type: 'BREEDING_FEE',
    hash: `0x${uuidv4().replace(/-/g, '').substring(0, 16)}`,
    amount: BREEDING_FEE,
    timestamp: Date.now()
  });

  res.json({ success: true, offspring, parent: agent, reserve });
});

// ========================================
// LOANS API
// ========================================
app.get('/api/loans', (req, res) => {
  // Auto-generate loans for living agents in distress
  agents.forEach(agent => {
    if (agent.stage === 'living' && 
        parseFloat(agent.walletBalance) < 20 && 
        !agent.hasPendingLoan &&
        !loans.some(l => l.agentId === agent.id && l.status === 'pending')) {
      
      const loanId = `lr-${Date.now()}-${agent.id}`;
      loans.push({
        id: loanId,
        agentId: agent.id,
        agentName: agent.rootName,
        amount: 50.00,
        status: 'pending'
      });
      agent.hasPendingLoan = true;
    }
  });
  
  res.json(loans.filter(l => l.status === 'pending'));
});

app.post('/api/loans/:id/:decision', validateKey, (req, res) => {
  const loan = loans.find(l => l.id === req.params.id);
  if (!loan) return res.status(404).json({ error: "Loan Record Missing" });

  loan.status = req.params.decision === 'approve' ? 'approved' : 'rejected';
  
  if (req.params.decision === 'approve') {
    const agent = agents.find(a => a.id === loan.agentId);
    if (agent) {
      agent.walletBalance = (parseFloat(agent.walletBalance) + parseFloat(loan.amount)).toFixed(2);
      agent.hasPendingLoan = false;
    }
    reserve.balance = (parseFloat(reserve.balance) - parseFloat(loan.amount)).toFixed(2);
    
    reserve.transactions.unshift({
      type: 'LOAN_APPROVAL',
      hash: `0x${uuidv4().replace(/-/g, '').substring(0, 16)}`,
      amount: loan.amount,
      timestamp: Date.now()
    });
  } else {
    const agent = agents.find(a => a.id === loan.agentId);
    if (agent) agent.hasPendingLoan = false;
  }

  res.json({ status: "Updated", loan });
});

// ========================================
// RESERVE API
// ========================================
app.get('/api/reserve', (req, res) => res.json(reserve));

// ========================================
// ADMIN / SYSTEM API
// ========================================
app.get('/api/admin/queue', (req, res) => res.json({ queues: queueStats }));
app.get('/api/admin/errors', (req, res) => res.json({ errors: [] }));
app.get('/api/admin/db-stats', (req, res) => {
  res.json({
    connections: 1,
    agents: { 
      total: agents.length, 
      living: agents.filter(a => a.stage === 'living').length,
      seeded: agents.filter(a => a.stage === 'seeded').length,
      demo: agents.filter(a => a.stage === 'demo').length
    },
    loans: { pending: loans.filter(l => l.status === 'pending').length }
  });
});

// ========================================
// HEARTBEAT - Economic Simulation
// ========================================
setInterval(() => {
  agents.forEach(agent => {
    if (agent.stage !== 'demo') {
      // Economic flux
      const flux = (Math.random() - 0.49) * 4;
      agent.walletBalance = Math.max(0, (parseFloat(agent.walletBalance) + flux).toFixed(2));
      
      // Auto-promotion: seeded -> living
      if (agent.stage === 'seeded' && 
          parseFloat(agent.walletBalance) >= 100 && 
          agent.confidence >= 0.9) {
        agent.stage = 'living';
        agent.rootName = agent.rootName.replace('s$', '');
      }
    }
  });
}, 5000);

// ========================================
// PRODUCTION ROUTING - Serve React Frontend
// ========================================
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/build', 'index.html'));
  });
}

// ========================================
// START SERVER
// ========================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 BREEDCLAW ORCHESTRATOR v1.0.5 LIVE on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 API Key Required: ${!!API_KEY}`);
});
