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

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MEMBERS_FILE = path.join(DATA_DIR, 'members.json');
const SALES_FILE = path.join(DATA_DIR, 'sales.json');
const TRANSFERS_FILE = path.join(DATA_DIR, 'transfers.json');

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
if (!fs.existsSync(TRANSFERS_FILE)) {
    fs.writeFileSync(TRANSFERS_FILE, JSON.stringify([]));
}

// Helper functions
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

function readTransfers() {
    const data = fs.readFileSync(TRANSFERS_FILE);
    return JSON.parse(data);
}

function writeTransfers(transfers) {
    fs.writeFileSync(TRANSFERS_FILE, JSON.stringify(transfers, null, 2));
}

// Generate random password
function generateRandomPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

// Generate username from full name
function generateUsername(fullName, phone) {
    // Remove special characters and spaces
    let base = fullName.toLowerCase().replace(/[^a-z]/g, '');
    // Take first 6 characters
    base = base.substring(0, 6);
    // Add last 4 digits of phone number
    const phoneSuffix = phone.slice(-4);
    return `${base}${phoneSuffix}`;
}

// ==================== CREATE DEFAULT ADMIN ====================

const createDefaultAdmin = async () => {
    const users = readUsers();
    const adminExists = users.find(u => u.username === 'admin');
    
    if (!adminExists) {
        const hashedPassword = await bcrypt.hash('Admin123!', 10);
        const admin = {
            id: 'admin_1',
            username: 'admin',
            email: 'admin@gambellacoffee.com',
            password: hashedPassword,
            fullName: 'System Administrator',
            role: 'admin',
            memberId: null,
            isActive: true,
            createdAt: new Date().toISOString()
        };
        users.push(admin);
        writeUsers(users);
        console.log('✅ Default admin created!');
        console.log('   Username: admin');
        console.log('   Password: Admin123!');
    }
};

// ==================== AUTH MIDDLEWARE ====================

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

// Member only middleware (for member portal)
const memberOnlyMiddleware = (req, res, next) => {
    if (req.user.role !== 'member' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied. Members only.' });
    }
    next();
};

// ==================== AUTH ROUTES ====================

// Member Login
app.post('/api/auth/member-login', async (req, res) => {
    console.log('Member login attempt:', req.body.username);
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password required' });
        }
        
        const users = readUsers();
        const user = users.find(u => u.username === username && u.role === 'member');
        
        if (!user) {
            console.log('Member not found:', username);
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log('Password incorrect for:', username);
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        if (!user.isActive) {
            return res.status(401).json({ message: 'Account is disabled' });
        }
        
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, memberId: user.memberId },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        console.log('Member login successful:', username);
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                role: user.role,
                memberId: user.memberId
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// Admin Login
app.post('/api/auth/login', async (req, res) => {
    console.log('Admin login attempt:', req.body.username);
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password required' });
        }
        
        const users = readUsers();
        const user = users.find(u => u.username === username && u.role === 'admin');
        
        if (!user) {
            console.log('Admin not found:', username);
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log('Password incorrect for:', username);
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        if (!user.isActive) {
            return res.status(401).json({ message: 'Account is disabled' });
        }
        
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, memberId: user.memberId },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        console.log('Admin login successful:', username);
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// Get current user
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

// ==================== MEMBER ROUTES ====================

// Register Member (creates both member record and user account)
app.post('/api/members/register', async (req, res) => {
    try {
        const members = readMembers();
        const users = readUsers();
        
        // Check if phone number already exists
        if (members.find(m => m.phone === req.body.phone)) {
            return res.status(400).json({ message: 'Phone number already registered' });
        }
        
        // Create member record
        const newMember = {
            id: 'member_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            ...req.body,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        members.push(newMember);
        writeMembers(members);
        
        // Generate username and password for member
        const username = generateUsername(newMember.fullName, newMember.phone);
        const plainPassword = generateRandomPassword();
        const hashedPassword = await bcrypt.hash(plainPassword, 10);
        
        // Create user account for member
        const newUser = {
            id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            username: username,
            email: newMember.phone + '@member.gambellacoffee.com',
            password: hashedPassword,
            fullName: newMember.fullName,
            role: 'member',
            memberId: newMember.id,
            isActive: true,
            createdAt: new Date().toISOString()
        };
        users.push(newUser);
        writeUsers(users);
        
        res.status(201).json({
            success: true,
            message: 'Member registered successfully',
            member: newMember,
            credentials: {
                username: username,
                password: plainPassword
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// Get all members (admin only)
app.get('/api/members', authMiddleware, async (req, res) => {
    try {
        // Members can only see count, not the list
        if (req.user.role === 'member') {
            const members = readMembers();
            return res.json({ count: members.length, members: [] });
        }
        
        const members = readMembers();
        res.json(members);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get member count (accessible by members)
app.get('/api/members/count', authMiddleware, async (req, res) => {
    try {
        const members = readMembers();
        res.json({ count: members.length });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get single member (members can only see their own profile)
app.get('/api/members/:id', authMiddleware, (req, res) => {
    try {
        const members = readMembers();
        const member = members.find(m => m.id === req.params.id);
        
        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }
        
        // Check if member is accessing their own profile
        if (req.user.role === 'member' && req.user.memberId !== req.params.id) {
            return res.status(403).json({ message: 'Access denied. You can only view your own profile.' });
        }
        
        res.json(member);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get member by user ID (for member portal)
app.get('/api/members/profile/my', authMiddleware, (req, res) => {
    try {
        if (req.user.role !== 'member' || !req.user.memberId) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        const members = readMembers();
        const member = members.find(m => m.id === req.user.memberId);
        
        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }
        
        res.json(member);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Update member (admin only - members cannot edit)
app.put('/api/members/:id', authMiddleware, (req, res) => {
    try {
        // Members cannot edit profiles
        if (req.user.role === 'member') {
            return res.status(403).json({ message: 'Access denied. Members cannot edit profiles.' });
        }
        
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

// Delete member (admin only)
app.delete('/api/members/:id', authMiddleware, (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }
        
        let members = readMembers();
        members = members.filter(m => m.id !== req.params.id);
        writeMembers(members);
        
        // Also delete associated user account
        let users = readUsers();
        users = users.filter(u => u.memberId !== req.params.id);
        writeUsers(users);
        
        res.json({ message: 'Member deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Search members (admin only)
app.get('/api/members/search/:query', authMiddleware, (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }
        
        const members = readMembers();
        const query = req.params.query.toLowerCase();
        const filtered = members.filter(m => 
            m.fullName.toLowerCase().includes(query) || 
            m.phone.includes(query) ||
            (m.role && m.role.toLowerCase().includes(query))
        );
        res.json(filtered);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== SALE ROUTES ====================

// Get all sales (admin only)
app.get('/api/sales', authMiddleware, (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }
        
        const sales = readSales();
        const members = readMembers();
        const salesWithMember = sales.map(sale => ({
            ...sale,
            member: members.find(m => m.id === sale.memberId)
        }));
        res.json(salesWithMember);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get sales by member (members can see their own sales)
app.get('/api/sales/member/:memberId', authMiddleware, (req, res) => {
    try {
        const sales = readSales();
        
        // Check if member is accessing their own sales
        if (req.user.role === 'member' && req.user.memberId !== req.params.memberId) {
            return res.status(403).json({ message: 'Access denied. You can only view your own sales.' });
        }
        
        const memberSales = sales.filter(s => s.memberId === req.params.memberId);
        res.json(memberSales);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Create sale (admin only)
app.post('/api/sales', authMiddleware, (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }
        
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

// Delete sale (admin only)
app.delete('/api/sales/:id', authMiddleware, (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }
        
        let sales = readSales();
        sales = sales.filter(s => s.id !== req.params.id);
        writeSales(sales);
        res.json({ message: 'Sale deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== TRANSFER ROUTES (Admin only) ====================

app.get('/api/transfers', authMiddleware, (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }
        
        const transfers = readTransfers();
        res.json(transfers);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/transfers', authMiddleware, (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }
        
        const transfers = readTransfers();
        const newTransfer = {
            id: 'transfer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            ...req.body,
            processedBy: req.user.id,
            createdAt: new Date().toISOString(),
            status: 'completed'
        };
        transfers.push(newTransfer);
        writeTransfers(transfers);
        res.status(201).json(newTransfer);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.delete('/api/transfers/:id', authMiddleware, (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }
        
        let transfers = readTransfers();
        transfers = transfers.filter(t => t.id !== req.params.id);
        writeTransfers(transfers);
        res.json({ message: 'Transfer deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== STATISTICS ROUTE ====================

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

app.get('/member-portal.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'member-portal.html'));
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 10000;

createDefaultAdmin().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📱 Admin Login: http://localhost:${PORT}`);
        console.log(`👤 Admin: admin / Admin123!`);
        console.log(`📱 Member Portal: http://localhost:${PORT}/member-portal.html`);
    });
});
