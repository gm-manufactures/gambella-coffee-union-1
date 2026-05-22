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

// ==================== AUTH ROUTES ====================

// Login
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
        
        if (!user.isActive) {
            return res.status(401).json({ message: 'Account is disabled' });
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

// Update user profile
app.put('/api/auth/update-profile', authMiddleware, async (req, res) => {
    try {
        const { oldPassword, fullName, username, email, newPassword } = req.body;
        const users = readUsers();
        const userIndex = users.findIndex(u => u.id === req.user.id);
        
        if (userIndex === -1) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const user = users[userIndex];
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        
        if (!isMatch) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }
        
        if (fullName) user.fullName = fullName;
        if (username) {
            // Check if username is taken
            const usernameExists = users.find(u => u.username === username && u.id !== user.id);
            if (usernameExists) {
                return res.status(400).json({ message: 'Username already taken' });
            }
            user.username = username;
        }
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
app.get('/api/auth/users', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }
        const users = readUsers();
        const usersWithoutPassword = users.map(({ password, ...rest }) => rest);
        res.json(usersWithoutPassword);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Create new user (admin only)
app.post('/api/auth/register', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }
        
        const { username, email, password, fullName, role } = req.body;
        
        if (!username || !email || !password || !fullName) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        
        const users = readUsers();
        
        if (users.find(u => u.username === username)) {
            return res.status(400).json({ message: 'Username already exists' });
        }
        
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ message: 'Email already exists' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            username,
            email,
            password: hashedPassword,
            fullName,
            role: role || 'staff',
            isActive: true,
            createdAt: new Date().toISOString()
        };
        
        users.push(newUser);
        writeUsers(users);
        
        const { password: _, ...userWithoutPassword } = newUser;
        res.json({ success: true, message: 'User created successfully', user: userWithoutPassword });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete user (admin only)
app.delete('/api/auth/users/:id', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }
        
        if (req.params.id === req.user.id) {
            return res.status(400).json({ message: 'Cannot delete your own account' });
        }
        
        let users = readUsers();
        users = users.filter(u => u.id !== req.params.id);
        writeUsers(users);
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Reset user password (admin only)
app.put('/api/auth/users/:id/reset-password', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }
        
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }
        
        const users = readUsers();
        const userIndex = users.findIndex(u => u.id === req.params.id);
        
        if (userIndex === -1) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        users[userIndex].password = await bcrypt.hash(newPassword, 10);
        writeUsers(users);
        res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== MEMBER ROUTES ====================

// Get all members
app.get('/api/members', authMiddleware, (req, res) => {
    try {
        const members = readMembers();
        res.json(members);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get single member
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

// Create member
app.post('/api/members', authMiddleware, async (req, res) => {
    try {
        const members = readMembers();
        const newMember = {
            id: 'member_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            ...req.body,
            createdBy: req.user.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        members.push(newMember);
        writeMembers(members);
        res.status(201).json(newMember);
    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// Update member
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

// Delete member
app.delete('/api/members/:id', authMiddleware, (req, res) => {
    try {
        let members = readMembers();
        members = members.filter(m => m.id !== req.params.id);
        writeMembers(members);
        res.json({ message: 'Member deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Search members
app.get('/api/members/search/:query', authMiddleware, (req, res) => {
    try {
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

// Get all sales
app.get('/api/sales', authMiddleware, (req, res) => {
    try {
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

// Get sales by member
app.get('/api/sales/member/:memberId', authMiddleware, (req, res) => {
    try {
        const sales = readSales();
        const memberSales = sales.filter(s => s.memberId === req.params.memberId);
        res.json(memberSales);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Create sale
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

// Delete sale
app.delete('/api/sales/:id', authMiddleware, (req, res) => {
    try {
        let sales = readSales();
        sales = sales.filter(s => s.id !== req.params.id);
        writeSales(sales);
        res.json({ message: 'Sale deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== TRANSFER ROUTES ====================

// Get all transfers
app.get('/api/transfers', authMiddleware, (req, res) => {
    try {
        const transfers = readTransfers();
        res.json(transfers);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Create transfer
app.post('/api/transfers', authMiddleware, (req, res) => {
    try {
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

// Delete transfer
app.delete('/api/transfers/:id', authMiddleware, (req, res) => {
    try {
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

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 10000;

createDefaultAdmin().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📱 Login at: http://localhost:${PORT}`);
        console.log(`👤 Default: admin / Admin123!`);
    });
});
