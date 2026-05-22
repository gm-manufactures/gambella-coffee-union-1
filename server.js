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
const TRADING_REQUESTS_FILE = path.join(DATA_DIR, 'trading_requests.json');

// Initialize data files
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]));
if (!fs.existsSync(MEMBERS_FILE)) fs.writeFileSync(MEMBERS_FILE, JSON.stringify([]));
if (!fs.existsSync(SALES_FILE)) fs.writeFileSync(SALES_FILE, JSON.stringify([]));
if (!fs.existsSync(TRANSFERS_FILE)) fs.writeFileSync(TRANSFERS_FILE, JSON.stringify([]));
if (!fs.existsSync(TRADING_REQUESTS_FILE)) fs.writeFileSync(TRADING_REQUESTS_FILE, JSON.stringify([]));

// Helper functions
function readUsers() { return JSON.parse(fs.readFileSync(USERS_FILE)); }
function writeUsers(users) { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2)); }
function readMembers() { return JSON.parse(fs.readFileSync(MEMBERS_FILE)); }
function writeMembers(members) { fs.writeFileSync(MEMBERS_FILE, JSON.stringify(members, null, 2)); }
function readSales() { return JSON.parse(fs.readFileSync(SALES_FILE)); }
function writeSales(sales) { fs.writeFileSync(SALES_FILE, JSON.stringify(sales, null, 2)); }
function readTransfers() { return JSON.parse(fs.readFileSync(TRANSFERS_FILE)); }
function writeTransfers(transfers) { fs.writeFileSync(TRANSFERS_FILE, JSON.stringify(transfers, null, 2)); }
function readTradingRequests() { return JSON.parse(fs.readFileSync(TRADING_REQUESTS_FILE)); }
function writeTradingRequests(requests) { fs.writeFileSync(TRADING_REQUESTS_FILE, JSON.stringify(requests, null, 2)); }

// Generate username and password
function generateUsername(fullName, phone) {
    let base = fullName.toLowerCase().replace(/[^a-z]/g, '').substring(0, 6);
    if (base.length < 3) base = 'member';
    return `${base}${phone.slice(-4)}`;
}

function generateRandomPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) password += chars.charAt(Math.floor(Math.random() * chars.length));
    return password;
}

// Create default admin
const createDefaultAdmin = async () => {
    const users = readUsers();
    if (!users.find(u => u.username === 'admin')) {
        users.push({
            id: 'admin_1',
            username: 'admin',
            email: 'admin@gambellacoffee.com',
            password: await bcrypt.hash('Admin123!', 10),
            fullName: 'System Administrator',
            role: 'admin',
            memberId: null,
            isActive: true,
            createdAt: new Date().toISOString()
        });
        writeUsers(users);
        console.log('✅ Default admin created! Username: admin, Password: Admin123!');
    }
};

// Auth middleware
const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch { res.status(401).json({ message: 'Invalid token' }); }
};

// ==================== AUTH ROUTES ====================
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const users = readUsers();
    const user = users.find(u => u.username === username && u.role === 'admin');
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    if (!await bcrypt.compare(password, user.password)) return res.status(401).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role } });
});

app.post('/api/auth/member-login', async (req, res) => {
    const { username, password } = req.body;
    const users = readUsers();
    const user = users.find(u => u.username === username && u.role === 'member');
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    if (!await bcrypt.compare(password, user.password)) return res.status(401).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, memberId: user.memberId }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role, memberId: user.memberId } });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
    const users = readUsers();
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { password, ...rest } = user;
    res.json(rest);
});

// Update user profile
app.put('/api/auth/update-profile', authMiddleware, async (req, res) => {
    try {
        const { oldPassword, fullName, username, email, newPassword } = req.body;
        const users = readUsers();
        const userIndex = users.findIndex(u => u.id === req.user.id);
        if (userIndex === -1) return res.status(404).json({ message: 'User not found' });
        
        const user = users[userIndex];
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Current password is incorrect' });
        
        if (fullName) user.fullName = fullName;
        if (username) user.username = username;
        if (email) user.email = email;
        if (newPassword && newPassword.length >= 6) {
            user.password = await bcrypt.hash(newPassword, 10);
        }
        writeUsers(users);
        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all users (admin only)
app.get('/api/auth/users', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
    const users = readUsers();
    const usersWithoutPassword = users.map(({ password, ...rest }) => rest);
    res.json(usersWithoutPassword);
});

// Create new user (admin only)
app.post('/api/auth/register', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
    const { username, email, password, fullName, role } = req.body;
    const users = readUsers();
    if (users.find(u => u.username === username)) return res.status(400).json({ message: 'Username already exists' });
    if (users.find(u => u.email === email)) return res.status(400).json({ message: 'Email already exists' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
        id: 'user_' + Date.now(),
        username, email, password: hashedPassword, fullName,
        role: role || 'staff', memberId: null, isActive: true,
        createdAt: new Date().toISOString()
    };
    users.push(newUser);
    writeUsers(users);
    const { password: _, ...userWithoutPassword } = newUser;
    res.json({ success: true, user: userWithoutPassword });
});

// Delete user (admin only)
app.delete('/api/auth/users/:id', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
    if (req.params.id === req.user.id) return res.status(400).json({ message: 'Cannot delete your own account' });
    let users = readUsers();
    users = users.filter(u => u.id !== req.params.id);
    writeUsers(users);
    res.json({ success: true });
});

// Reset user password (admin only)
app.put('/api/auth/users/:id/reset-password', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    const users = readUsers();
    const userIndex = users.findIndex(u => u.id === req.params.id);
    if (userIndex === -1) return res.status(404).json({ message: 'User not found' });
    users[userIndex].password = await bcrypt.hash(newPassword, 10);
    writeUsers(users);
    res.json({ success: true });
});

// ==================== MEMBER ROUTES ====================

// Register member (creates both member and user account)
app.post('/api/members/register', async (req, res) => {
    try {
        const members = readMembers();
        const users = readUsers();
        
        // Check if phone already exists
        if (members.find(m => m.phone === req.body.phone)) {
            return res.status(400).json({ message: 'Phone number already registered' });
        }
        
        // Create new member
        const newMember = {
            id: 'member_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            ...req.body,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        members.push(newMember);
        writeMembers(members);
        
        // Generate credentials
        const username = generateUsername(newMember.fullName, newMember.phone);
        const plainPassword = generateRandomPassword();
        const hashedPassword = await bcrypt.hash(plainPassword, 10);
        
        // Create user account for member
        const newUser = {
            id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            username: username,
            email: newMember.phone + '@member.gambella.com',
            password: hashedPassword,
            fullName: newMember.fullName,
            role: 'member',
            memberId: newMember.id,
            isActive: true,
            createdAt: new Date().toISOString()
        };
        users.push(newUser);
        writeUsers(users);
        
        console.log(`✅ New member registered: ${newMember.fullName} | Username: ${username} | Password: ${plainPassword}`);
        
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

// Get all members
app.get('/api/members', authMiddleware, (req, res) => {
    const members = readMembers();
    if (req.user.role === 'member') {
        return res.json({ count: members.length, members: [] });
    }
    res.json(members);
});

// Get member count
app.get('/api/members/count', authMiddleware, (req, res) => {
    res.json({ count: readMembers().length });
});

// Get member by ID
app.get('/api/members/:id', authMiddleware, (req, res) => {
    const members = readMembers();
    const member = members.find(m => m.id === req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    if (req.user.role === 'member' && req.user.memberId !== req.params.id) {
        return res.status(403).json({ message: 'Access denied' });
    }
    res.json(member);
});

// Get my profile (for members)
app.get('/api/members/profile/my', authMiddleware, (req, res) => {
    if (req.user.role !== 'member' || !req.user.memberId) {
        return res.status(403).json({ message: 'Access denied' });
    }
    const members = readMembers();
    const member = members.find(m => m.id === req.user.memberId);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    res.json(member);
});

// Update member (admin only)
app.put('/api/members/:id', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const members = readMembers();
    const index = members.findIndex(m => m.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'Member not found' });
    members[index] = { ...members[index], ...req.body, updatedAt: new Date().toISOString() };
    writeMembers(members);
    res.json(members[index]);
});

// Delete member (admin only)
app.delete('/api/members/:id', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    let members = readMembers();
    members = members.filter(m => m.id !== req.params.id);
    writeMembers(members);
    // Also delete associated user account
    let users = readUsers();
    users = users.filter(u => u.memberId !== req.params.id);
    writeUsers(users);
    res.json({ message: 'Member deleted successfully' });
});

// Search members (admin only)
app.get('/api/members/search/:query', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const members = readMembers();
    const q = req.params.query.toLowerCase();
    const filtered = members.filter(m => 
        m.fullName?.toLowerCase().includes(q) || 
        m.phone?.includes(q) ||
        m.role?.toLowerCase().includes(q)
    );
    res.json(filtered);
});

// ==================== SALE ROUTES ====================
app.get('/api/sales', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    res.json(readSales());
});

app.get('/api/sales/member/:memberId', authMiddleware, (req, res) => {
    if (req.user.role === 'member' && req.user.memberId !== req.params.memberId) {
        return res.status(403).json({ message: 'Access denied' });
    }
    res.json(readSales().filter(s => s.memberId === req.params.memberId));
});

app.post('/api/sales', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const sales = readSales();
    const newSale = {
        id: 'sale_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        ...req.body,
        recordedBy: req.user.id,
        createdAt: new Date().toISOString()
    };
    sales.push(newSale);
    writeSales(sales);
    res.status(201).json(newSale);
});

app.delete('/api/sales/:id', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    let sales = readSales();
    sales = sales.filter(s => s.id !== req.params.id);
    writeSales(sales);
    res.json({ message: 'Sale deleted' });
});

// ==================== TRANSFER ROUTES ====================
app.get('/api/transfers', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    res.json(readTransfers());
});

app.post('/api/transfers', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const transfers = readTransfers();
    const newTransfer = {
        id: 'transfer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        ...req.body,
        processedBy: req.user.id,
        createdAt: new Date().toISOString(),
        status: 'completed'
    };
    transfers.push(newTransfer);
    writeTransfers(transfers);
    res.status(201).json(newTransfer);
});

app.delete('/api/transfers/:id', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    let transfers = readTransfers();
    transfers = transfers.filter(t => t.id !== req.params.id);
    writeTransfers(transfers);
    res.json({ message: 'Transfer deleted' });
});

// ==================== SHARE TRADING ROUTES ====================
app.post('/api/share-trading/request', authMiddleware, async (req, res) => {
    if (req.user.role !== 'member') return res.status(403).json({ message: 'Members only' });
    const { requestType, shareAmount, pricePerShare = 1000, notes } = req.body;
    if (!requestType || !shareAmount || shareAmount <= 0) {
        return res.status(400).json({ message: 'Invalid request' });
    }
    
    const members = readMembers();
    const member = members.find(m => m.id === req.user.memberId);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    
    if (requestType === 'sell' && (member.shareCount || 0) < shareAmount) {
        return res.status(400).json({ message: `Insufficient shares. You have only ${member.shareCount || 0} shares.` });
    }
    
    const requests = readTradingRequests();
    const newRequest = {
        id: 'trade_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        memberId: req.user.memberId,
        memberName: member.fullName,
        memberPhone: member.phone,
        requestType: requestType,
        shareAmount: shareAmount,
        pricePerShare: pricePerShare,
        totalValue: pricePerShare * shareAmount,
        status: 'pending',
        notes: notes || '',
        createdAt: new Date().toISOString(),
        processedBy: null,
        processedAt: null
    };
    requests.push(newRequest);
    writeTradingRequests(requests);
    res.status(201).json({ success: true, request: newRequest });
});

app.get('/api/share-trading/my-requests', authMiddleware, (req, res) => {
    if (req.user.role !== 'member') return res.status(403).json({ message: 'Members only' });
    const requests = readTradingRequests();
    res.json(requests.filter(r => r.memberId === req.user.memberId));
});

app.get('/api/share-trading/requests', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    res.json(readTradingRequests());
});

app.get('/api/share-trading/pending', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    res.json(readTradingRequests().filter(r => r.status === 'pending'));
});

app.post('/api/share-trading/approve/:id', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    
    const requests = readTradingRequests();
    const requestIndex = requests.findIndex(r => r.id === req.params.id);
    if (requestIndex === -1) return res.status(404).json({ message: 'Request not found' });
    
    const request = requests[requestIndex];
    if (request.status !== 'pending') return res.status(400).json({ message: 'Request already processed' });
    
    const members = readMembers();
    const memberIndex = members.findIndex(m => m.id === request.memberId);
    if (memberIndex === -1) return res.status(404).json({ message: 'Member not found' });
    
    const member = members[memberIndex];
    const currentShares = member.shareCount || 0;
    
    if (request.requestType === 'buy') {
        members[memberIndex].shareCount = currentShares + request.shareAmount;
    } else if (request.requestType === 'sell') {
        if (currentShares < request.shareAmount) {
            return res.status(400).json({ message: 'Insufficient shares' });
        }
        members[memberIndex].shareCount = currentShares - request.shareAmount;
    }
    
    requests[requestIndex].status = 'approved';
    requests[requestIndex].processedBy = req.user.id;
    requests[requestIndex].processedAt = new Date().toISOString();
    
    writeMembers(members);
    writeTradingRequests(requests);
    
    res.json({ success: true, message: 'Request approved successfully' });
});

app.post('/api/share-trading/reject/:id', authMiddleware, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    
    const requests = readTradingRequests();
    const requestIndex = requests.findIndex(r => r.id === req.params.id);
    if (requestIndex === -1) return res.status(404).json({ message: 'Request not found' });
    
    if (requests[requestIndex].status !== 'pending') {
        return res.status(400).json({ message: 'Request already processed' });
    }
    
    requests[requestIndex].status = 'rejected';
    requests[requestIndex].processedBy = req.user.id;
    requests[requestIndex].processedAt = new Date().toISOString();
    requests[requestIndex].rejectionReason = req.body.reason || 'No reason provided';
    
    writeTradingRequests(requests);
    res.json({ success: true, message: 'Request rejected' });
});

app.get('/api/share-trading/stats', authMiddleware, (req, res) => {
    const members = readMembers();
    const requests = readTradingRequests();
    const totalShares = members.reduce((sum, m) => sum + (m.shareCount || 0), 0);
    const pendingRequests = requests.filter(r => r.status === 'pending').length;
    const approvedRequests = requests.filter(r => r.status === 'approved').length;
    const totalBuyShares = requests.filter(r => r.requestType === 'buy').reduce((sum, r) => sum + r.shareAmount, 0);
    const totalSellShares = requests.filter(r => r.requestType === 'sell').reduce((sum, r) => sum + r.shareAmount, 0);
    
    res.json({
        totalShares, pendingRequests, approvedRequests,
        totalBuyShares, totalSellShares
    });
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
    });
});
