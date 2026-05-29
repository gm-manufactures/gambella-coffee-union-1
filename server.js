const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'gambella-secret-key-2024';

// ==================== MONGODB SCHEMAS ====================

// User Schema
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    fullName: { type: String, required: true },
    role: { type: String, enum: ['admin', 'manager', 'staff', 'member'], default: 'staff' },
    memberId: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

UserSchema.methods.comparePassword = async function(candidate) {
    return await bcrypt.compare(candidate, this.password);
};

const User = mongoose.model('User', UserSchema);

// Member Schema
const MemberSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    gender: { type: String, required: true },
    age: { type: Number, required: true },
    motherName: { type: String, required: true },
    nationality: { type: String, default: 'Ethiopian' },
    education: { type: String },
    address: { type: String, required: true },
    region: { type: String },
    zone: { type: String },
    district: { type: String },
    city: { type: String },
    kebele: { type: String },
    houseNumber: { type: String },
    phone: { type: String, required: true, unique: true },
    taxId: { type: String },
    role: { type: String, required: true },
    shareCount: { type: Number, default: 0 },
    sharePercentage: { type: Number, default: 0 },
    sharePrice: { type: Number, default: 10000 },
    totalPayable: { type: Number, default: 0 },
    sharePricePaid: { type: Number, default: 0 },
    remainingBalance: { type: Number, default: 0 },
    paymentStatus: { type: String, default: 'አልተከፈለም' },
    year1Payment: { type: Number, default: 0 },
    year2Payment: { type: Number, default: 0 },
    year3Payment: { type: Number, default: 0 },
    bankName: { type: String },
    bankBranch: { type: String },
    accountNumber: { type: String },
    accountName: { type: String },
    financialNotes: { type: String },
    beneficiaries: { type: Array, default: [] },
    beneficiaryCount: { type: Number, default: 0 },
    legalRepName: { type: String },
    legalRepAddress: { type: String },
    legalRepPhone: { type: String },
    powerOfAttorneyType: { type: String },
    powerOfAttorneyNumber: { type: String },
    powerOfAttorneyDate: { type: String },
    powerOfAttorneyIssuer: { type: String },
    powerOfAttorneyExpiry: { type: String },
    powerOfAttorneyNotes: { type: String },
    memberPhoto: { type: String },
    memberTaxDoc: { type: String },
    repPhoto: { type: String },
    repTaxDoc: { type: String },
    hardCopyForm: { type: String },
    powerOfAttorneyPhoto: { type: String },
    hardCopyDocumentPhoto: { type: String },
    createdBy: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Member = mongoose.model('Member', MemberSchema);

// Sale Schema
const SaleSchema = new mongoose.Schema({
    memberId: { type: String, required: true },
    memberName: { type: String },
    collectionType: { type: String, default: 'member' },
    nonMemberName: { type: String },
    date: { type: Date, required: true },
    productType: { type: String, required: true },
    quantity: { type: Number, required: true },
    pricePerKg: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    paymentMethod: { type: String, required: true },
    notes: { type: String },
    receiptPhoto: { type: String },
    recordedBy: { type: String },
    createdAt: { type: Date, default: Date.now }
});

const Sale = mongoose.model('Sale', SaleSchema);

// Transfer Schema
const TransferSchema = new mongoose.Schema({
    oldMemberId: { type: String, required: true },
    oldMemberName: { type: String, required: true },
    newMemberName: { type: String, required: true },
    newMemberIdNumber: { type: String },
    newMemberPhone: { type: String },
    transferDate: { type: Date, required: true },
    transferFee: { type: Number, default: 0 },
    transferReason: { type: String },
    transferDocument: { type: String },
    status: { type: String, default: 'completed' },
    processedBy: { type: String },
    createdAt: { type: Date, default: Date.now }
});

const Transfer = mongoose.model('Transfer', TransferSchema);

// Trading Request Schema
const TradingRequestSchema = new mongoose.Schema({
    memberId: { type: String, required: true },
    memberName: { type: String, required: true },
    memberPhone: { type: String },
    requestType: { type: String, enum: ['buy', 'sell'], required: true },
    shareAmount: { type: Number, required: true },
    pricePerShare: { type: Number, default: 10000 },
    totalValue: { type: Number, required: true },
    status: { type: String, default: 'pending' },
    notes: { type: String },
    rejectionReason: { type: String },
    processedBy: { type: String },
    processedAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

const TradingRequest = mongoose.model('TradingRequest', TradingRequestSchema);

// ==================== HELPER FUNCTIONS ====================

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

// ==================== AUTH MIDDLEWARE ====================

const authMiddleware = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch { 
        res.status(401).json({ message: 'Invalid token' }); 
    }
};

// ==================== AUTH ROUTES ====================

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username, role: 'admin' });
        if (!user) return res.status(401).json({ message: 'Invalid credentials' });
        if (!await user.comparePassword(password)) return res.status(401).json({ message: 'Invalid credentials' });
        
        user.lastLogin = new Date();
        await user.save();
        
        const token = jwt.sign({ id: user._id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ success: true, token, user: { id: user._id, username: user.username, fullName: user.fullName, role: user.role } });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/auth/member-login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username, role: 'member' });
        if (!user) return res.status(401).json({ message: 'Invalid credentials' });
        if (!await user.comparePassword(password)) return res.status(401).json({ message: 'Invalid credentials' });
        
        const token = jwt.sign({ id: user._id, username: user.username, role: user.role, memberId: user.memberId }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ success: true, token, user: { id: user._id, username: user.username, fullName: user.fullName, role: user.role, memberId: user.memberId } });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.put('/api/auth/update-profile', authMiddleware, async (req, res) => {
    try {
        const { oldPassword, fullName, username, email, newPassword } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        
        const isMatch = await user.comparePassword(oldPassword);
        if (!isMatch) return res.status(401).json({ message: 'Current password is incorrect' });
        
        if (fullName) user.fullName = fullName;
        if (username) user.username = username;
        if (email) user.email = email;
        if (newPassword && newPassword.length >= 6) {
            user.password = newPassword;
            await user.save();
        } else {
            await user.save();
        }
        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/auth/users', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
    const users = await User.find({}, '-password');
    res.json(users);
});

app.post('/api/auth/register', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
    const { username, email, password, fullName, role } = req.body;
    
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });
    
    const newUser = new User({ username, email, password, fullName, role: role || 'staff' });
    await newUser.save();
    res.json({ success: true, user: { id: newUser._id, username, email, fullName, role } });
});

app.delete('/api/auth/users/:id', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
    if (req.params.id === req.user.id) return res.status(400).json({ message: 'Cannot delete your own account' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

app.put('/api/auth/users/:id/reset-password', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.password = newPassword;
    await user.save();
    res.json({ success: true });
});

// ==================== MEMBER ROUTES ====================

app.post('/api/members/register', async (req, res) => {
    console.log("📝 Registration request:", req.body.fullName);
    try {
        const existingMember = await Member.findOne({ phone: req.body.phone });
        if (existingMember) {
            return res.status(400).json({ message: 'Phone number already registered' });
        }
        
        const newMember = new Member({
            ...req.body,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        await newMember.save();
        
        const username = generateUsername(newMember.fullName, newMember.phone);
        const plainPassword = generateRandomPassword();
        
        const newUser = new User({
            username: username,
            email: newMember.phone + '@member.gambella.com',
            password: plainPassword,
            fullName: newMember.fullName,
            role: 'member',
            memberId: newMember._id.toString(),
            isActive: true
        });
        await newUser.save();
        
        console.log(`✅ Member registered: ${newMember.fullName} | Username: ${username}`);
        
        res.status(201).json({
            success: true,
            member: newMember,
            credentials: { username, password: plainPassword }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

app.get('/api/members', authMiddleware, async (req, res) => {
    const members = await Member.find().sort({ createdAt: -1 });
    if (req.user.role === 'member') {
        return res.json({ count: members.length, members: [] });
    }
    res.json(members);
});

app.get('/api/members/count', authMiddleware, async (req, res) => {
    const count = await Member.countDocuments();
    res.json({ count });
});

app.get('/api/members/:id', authMiddleware, async (req, res) => {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    if (req.user.role === 'member' && req.user.memberId !== req.params.id) {
        return res.status(403).json({ message: 'Access denied' });
    }
    res.json(member);
});

app.get('/api/members/profile/my', authMiddleware, async (req, res) => {
    if (req.user.role !== 'member' || !req.user.memberId) {
        return res.status(403).json({ message: 'Access denied' });
    }
    const member = await Member.findById(req.user.memberId);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    res.json(member);
});

app.put('/api/members/:id', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const member = await Member.findByIdAndUpdate(
        req.params.id,
        { ...req.body, updatedAt: new Date() },
        { new: true }
    );
    if (!member) return res.status(404).json({ message: 'Member not found' });
    res.json(member);
});

app.delete('/api/members/:id', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    await Member.findByIdAndDelete(req.params.id);
    await User.findOneAndDelete({ memberId: req.params.id });
    res.json({ message: 'Member deleted successfully' });
});

app.get('/api/members/search/:query', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const q = req.params.query;
    const members = await Member.find({
        $or: [
            { fullName: { $regex: q, $options: 'i' } },
            { phone: { $regex: q, $options: 'i' } }
        ]
    });
    res.json(members);
});

// ==================== SALE ROUTES ====================

app.get('/api/sales', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const sales = await Sale.find().sort({ date: -1 });
    res.json(sales);
});

app.get('/api/sales/member/:memberId', authMiddleware, async (req, res) => {
    if (req.user.role === 'member' && req.user.memberId !== req.params.memberId) {
        return res.status(403).json({ message: 'Access denied' });
    }
    const sales = await Sale.find({ memberId: req.params.memberId }).sort({ date: -1 });
    res.json(sales);
});

app.post('/api/sales', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const sale = new Sale(req.body);
    await sale.save();
    res.status(201).json(sale);
});

app.delete('/api/sales/:id', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    await Sale.findByIdAndDelete(req.params.id);
    res.json({ message: 'Sale deleted' });
});

// ==================== TRANSFER ROUTES ====================

app.get('/api/transfers', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const transfers = await Transfer.find().sort({ createdAt: -1 });
    res.json(transfers);
});

app.post('/api/transfers', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const transfer = new Transfer(req.body);
    await transfer.save();
    res.status(201).json(transfer);
});

app.delete('/api/transfers/:id', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    await Transfer.findByIdAndDelete(req.params.id);
    res.json({ message: 'Transfer deleted' });
});

// ==================== TRADING ROUTES ====================

app.post('/api/share-trading/request', authMiddleware, async (req, res) => {
    if (req.user.role !== 'member') return res.status(403).json({ message: 'Members only' });
    const { requestType, shareAmount, pricePerShare = 10000, notes } = req.body;
    if (!requestType || !shareAmount || shareAmount <= 0) {
        return res.status(400).json({ message: 'Invalid request' });
    }
    
    const member = await Member.findById(req.user.memberId);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    
    if (requestType === 'sell' && (member.shareCount || 0) < shareAmount) {
        return res.status(400).json({ message: `Insufficient shares. You have only ${member.shareCount || 0} shares.` });
    }
    
    const request = new TradingRequest({
        memberId: req.user.memberId,
        memberName: member.fullName,
        memberPhone: member.phone,
        requestType,
        shareAmount,
        pricePerShare,
        totalValue: pricePerShare * shareAmount,
        notes: notes || ''
    });
    await request.save();
    res.status(201).json({ success: true, request });
});

app.get('/api/share-trading/my-requests', authMiddleware, async (req, res) => {
    if (req.user.role !== 'member') return res.status(403).json({ message: 'Members only' });
    const requests = await TradingRequest.find({ memberId: req.user.memberId }).sort({ createdAt: -1 });
    res.json(requests);
});

app.get('/api/share-trading/requests', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const requests = await TradingRequest.find().sort({ createdAt: -1 });
    res.json(requests);
});

app.get('/api/share-trading/pending', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const requests = await TradingRequest.find({ status: 'pending' }).sort({ createdAt: -1 });
    res.json(requests);
});

app.post('/api/share-trading/approve/:id', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    
    const request = await TradingRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ message: 'Request already processed' });
    
    const member = await Member.findById(request.memberId);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    
    if (request.requestType === 'buy') {
        member.shareCount = (member.shareCount || 0) + request.shareAmount;
    } else if (request.requestType === 'sell') {
        if ((member.shareCount || 0) < request.shareAmount) {
            return res.status(400).json({ message: 'Insufficient shares' });
        }
        member.shareCount = (member.shareCount || 0) - request.shareAmount;
    }
    
    await member.save();
    
    request.status = 'approved';
    request.processedBy = req.user.id;
    request.processedAt = new Date();
    await request.save();
    
    res.json({ success: true, message: 'Request approved successfully' });
});

app.post('/api/share-trading/reject/:id', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    
    const request = await TradingRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ message: 'Request already processed' });
    
    request.status = 'rejected';
    request.processedBy = req.user.id;
    request.processedAt = new Date();
    request.rejectionReason = req.body.reason || 'No reason provided';
    await request.save();
    
    res.json({ success: true, message: 'Request rejected' });
});

app.get('/api/share-trading/stats', authMiddleware, async (req, res) => {
    const members = await Member.find();
    const requests = await TradingRequest.find();
    const totalShares = members.reduce((sum, m) => sum + (m.shareCount || 0), 0);
    const pendingRequests = requests.filter(r => r.status === 'pending').length;
    const approvedRequests = requests.filter(r => r.status === 'approved').length;
    const totalBuyShares = requests.filter(r => r.requestType === 'buy').reduce((sum, r) => sum + r.shareAmount, 0);
    const totalSellShares = requests.filter(r => r.requestType === 'sell').reduce((sum, r) => sum + r.shareAmount, 0);
    
    res.json({ totalShares, pendingRequests, approvedRequests, totalBuyShares, totalSellShares });
});

// ==================== CREATE DEFAULT ADMIN ====================

const createDefaultAdmin = async () => {
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
        const admin = new User({
            username: 'admin',
            email: 'admin@gambellacoffee.com',
            password: 'Admin123!',
            fullName: 'System Administrator',
            role: 'admin'
        });
        await admin.save();
        console.log('✅ Default admin created! Username: admin, Password: Admin123!');
    }
};

// ==================== SERVE FRONTEND ====================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/gmfc.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'gmfc.html'));
});

app.get('/member-portal.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'member-portal.html'));
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 10000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gambella_coffee_union-1';

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('✅ MongoDB connected successfully');
        await createDefaultAdmin();
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📱 Admin Login: http://localhost:${PORT}`);
            console.log(`👤 Admin: admin / Admin123!`);
        });
    })
    .catch(err => {
        console.error('❌ MongoDB connection error:', err.message);
        process.exit(1);
    });
