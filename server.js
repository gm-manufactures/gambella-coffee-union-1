const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));

// JWT Secret
const JWT_SECRET = 'gambella-secret-key-2024';

// ==================== FILE STORAGE SETUP ====================

// Data directory
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// File paths
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MEMBERS_FILE = path.join(DATA_DIR, 'members.json');
const SALES_FILE = path.join(DATA_DIR, 'sales.json');

// Initialize data files
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
}
if (!fs.existsSync(MEMBERS_FILE)) {
    fs.writeFileSync(MEMBERS_FILE, JSON.stringify([]));
}
if (!fs.existsSync(SALES_FILE)) {
    fs.writeFileSync(SALES_FILE, JSON.stringify([]));
}

// Helper functions to read/write data
function readUsers() {
    const data = fs.readFileSync(USERS_FILE);
    return JSON.parse(data);
}

function writeUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function readMembers() {
    const data = fs.readFileSync(MEMBERS_FILE);
    return JSON.parse(data);
}

function writeMembers(members) {
    fs.writeFileSync(MEMBERS_FILE, JSON.stringify(members, null, 2));
}

function readSales() {
    const data = fs.readFileSync(SALES_FILE);
    return JSON.parse(data);
}

function writeSales(sales) {
    fs.writeFileSync(SALES_FILE, JSON.stringify(sales, null, 2));
}

// ==================== CREATE DEFAULT ADMIN ====================

const createDefaultAdmin = async () => {
    const users = readUsers();
    const adminExists = users.find(u => u.username === 'GMFC');
    
    if (!adminExists) {
        const hashedPassword = await bcrypt.hash('@GMFC120815', 10);
        const admin = {
            id: 'admin_1',
            username: 'admin',
            email: 'admin@gambellacoffee.com',
            password: hashedPassword,
            fullName: 'System Administrator',
            role: 'admin',
            isActive: true,
            createdAt: new Date().toISOString()
        };
        users.push(admin);
        writeUsers(users);
        console.log('✅ Default admin created!');
        console.log('   Username: admin');
        console.log('   Password: Admin123!');
    } else {
        console.log('✅ Admin user already exists');
    }
};

// ==================== MIDDLEWARE ====================

const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

// ==================== API ROUTES ====================

// LOGIN ROUTE
app.post('/api/auth/login', async (req, res) => {
    console.log('Login attempt:', req.body.username);
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password required' });
        }
        
        const users = readUsers();
        const user = users.find(u => u.username === username);
        
        if (!user) {
            console.log('User not found:', username);
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log('Password incorrect for:', username);
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        console.log('Login successful:', username);
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: user.fullName,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// GET CURRENT USER
app.get('/api/auth/me', authMiddleware, (req, res) => {
    try {
        const users = readUsers();
        const user = users.find(u => u.id === req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET ALL MEMBERS
app.get('/api/members', authMiddleware, (req, res) => {
    try {
        const members = readMembers();
        res.json(members);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET SINGLE MEMBER
app.get('/api/members/:id', authMiddleware, (req, res) => {
    try {
        const members = readMembers();
        const member = members.find(m => m.id === req.params.id);
        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }
        res.json(member);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// CREATE MEMBER
app.post('/api/members', authMiddleware, async (req, res) => {
    try {
        const members = readMembers();
        const newMember = {
            id: 'member_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            ...req.body,
            createdBy: req.user.id,
            createdAt: new Date().toISOString()
        };
        members.push(newMember);
        writeMembers(members);
        res.status(201).json(newMember);
    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// UPDATE MEMBER
app.put('/api/members/:id', authMiddleware, (req, res) => {
    try {
        const members = readMembers();
        const index = members.findIndex(m => m.id === req.params.id);
        if (index === -1) {
            return res.status(404).json({ message: 'Member not found' });
        }
        members[index] = { ...members[index], ...req.body, updatedAt: new Date().toISOString() };
        writeMembers(members);
        res.json(members[index]);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE MEMBER
app.delete('/api/members/:id', authMiddleware, (req, res) => {
    try {
        let members = readMembers();
        members = members.filter(m => m.id !== req.params.id);
        writeMembers(members);
        res.json({ message: 'Member deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// SEARCH MEMBERS
app.get('/api/members/search/:query', authMiddleware, (req, res) => {
    try {
        const members = readMembers();
        const query = req.params.query.toLowerCase();
        const filtered = members.filter(m => 
            m.fullName.toLowerCase().includes(query) || 
            m.phone.includes(query)
        );
        res.json(filtered);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET ALL SALES
app.get('/api/sales', authMiddleware, (req, res) => {
    try {
        const sales = readSales();
        const members = readMembers();
        const salesWithMember = sales.map(sale => ({
            ...sale,
            memberId: sale.memberId,
            member: members.find(m => m.id === sale.memberId)
        }));
        res.json(salesWithMember);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET SALES BY MEMBER
app.get('/api/sales/member/:memberId', authMiddleware, (req, res) => {
    try {
        const sales = readSales();
        const memberSales = sales.filter(s => s.memberId === req.params.memberId);
        res.json(memberSales);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// CREATE SALE
app.post('/api/sales', authMiddleware, (req, res) => {
    try {
        const sales = readSales();
        const newSale = {
            id: 'sale_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            ...req.body,
            recordedBy: req.user.id,
            createdAt: new Date().toISOString()
        };
        sales.push(newSale);
        writeSales(sales);
        res.status(201).json(newSale);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE SALE
app.delete('/api/sales/:id', authMiddleware, (req, res) => {
    try {
        let sales = readSales();
        sales = sales.filter(s => s.id !== req.params.id);
        writeSales(sales);
        res.json({ message: 'Sale deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET STATISTICS
app.get('/api/stats', authMiddleware, (req, res) => {
    try {
        const members = readMembers();
        const sales = readSales();
        const totalMembers = members.length;
        const totalSales = sales.length;
        const totalRevenue = sales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
        const totalQuantity = sales.reduce((sum, sale) => sum + (sale.quantity || 0), 0);
        
        res.json({
            totalMembers,
            totalSales,
            totalRevenue,
            totalQuantity
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== SERVE FRONTEND ====================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 10000;

// Create default admin before starting
createDefaultAdmin().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📱 Login at: http://localhost:${PORT}`);
        console.log(`👤 Default: admin / Admin123!`);
    });
});
