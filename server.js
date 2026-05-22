const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200
});
app.use('/api/', limiter);

// Serve HTML files from root directory
app.use(express.static(__dirname));

// ==================== MODELS ====================

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    fullName: { type: String, required: true },
    role: { type: String, default: 'staff' },
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

const MemberSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    gender: { type: String, required: true },
    age: { type: Number, required: true },
    motherName: { type: String, required: true },
    nationality: { type: String, default: 'Ethiopian' },
    education: { type: String },
    address: { type: String, required: true },
    phone: { type: String, required: true },
    taxId: { type: String },
    role: { type: String, required: true },
    beneficiaryName: { type: String },
    beneficiaryAddress: { type: String },
    legalRepName: { type: String },
    legalRepAddress: { type: String },
    legalRepPhone: { type: String },
    memberPhoto: { type: String },
    memberTaxDoc: { type: String },
    beneficiaryPhoto: { type: String },
    beneficiaryTaxDoc: { type: String },
    repPhoto: { type: String },
    repTaxDoc: { type: String },
    hardCopyForm: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Member = mongoose.model('Member', MemberSchema);

const SaleSchema = new mongoose.Schema({
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    date: { type: Date, required: true },
    productType: { type: String, required: true },
    quantity: { type: Number, required: true },
    pricePerKg: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    paymentMethod: { type: String, required: true },
    notes: { type: String },
    receiptPhoto: { type: String },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

const Sale = mongoose.model('Sale', SaleSchema);

const TransferSchema = new mongoose.Schema({
    oldMemberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    oldMemberName: { type: String, required: true },
    newMemberName: { type: String, required: true },
    newMemberIdNumber: { type: String },
    newMemberPhone: { type: String },
    transferDate: { type: Date, required: true },
    transferFee: { type: Number, default: 0 },
    transferReason: { type: String },
    transferDocument: { type: String },
    status: { type: String, default: 'completed' },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

const Transfer = mongoose.model('Transfer', TransferSchema);

// ==================== MIDDLEWARE ====================

const JWT_SECRET = process.env.JWT_SECRET || 'gambella-secret-key-2024';

const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

// ==================== AUTH ROUTES ====================

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(401).json({ message: 'Invalid credentials' });
        
        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
        
        user.lastLogin = new Date();
        await user.save();
        
        const token = jwt.sign({ id: user._id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
        
        res.json({
            token,
            user: { id: user._id, username: user.username, email: user.email, fullName: user.fullName, role: user.role }
        });
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

// ==================== MEMBER ROUTES ====================

app.get('/api/members', authMiddleware, async (req, res) => {
    try {
        const members = await Member.find().sort({ createdAt: -1 });
        res.json(members);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/members/:id', authMiddleware, async (req, res) => {
    try {
        const member = await Member.findById(req.params.id);
        if (!member) return res.status(404).json({ message: 'Not found' });
        res.json(member);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/members', authMiddleware, async (req, res) => {
    try {
        const member = new Member({ ...req.body, createdBy: req.user.id });
        await member.save();
        res.status(201).json(member);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.put('/api/members/:id', authMiddleware, async (req, res) => {
    try {
        const member = await Member.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updatedAt: Date.now() },
            { new: true }
        );
        res.json(member);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.delete('/api/members/:id', authMiddleware, async (req, res) => {
    try {
        await Member.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/members/search/:query', authMiddleware, async (req, res) => {
    try {
        const members = await Member.find({
            $or: [
                { fullName: { $regex: req.params.query, $options: 'i' } },
                { phone: { $regex: req.params.query, $options: 'i' } }
            ]
        });
        res.json(members);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== SALE ROUTES ====================

app.get('/api/sales', authMiddleware, async (req, res) => {
    try {
        const sales = await Sale.find().populate('memberId', 'fullName phone').sort({ date: -1 });
        res.json(sales);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/sales/member/:memberId', authMiddleware, async (req, res) => {
    try {
        const sales = await Sale.find({ memberId: req.params.memberId }).sort({ date: -1 });
        res.json(sales);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/sales', authMiddleware, async (req, res) => {
    try {
        const sale = new Sale({ ...req.body, recordedBy: req.user.id });
        await sale.save();
        res.status(201).json(sale);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.delete('/api/sales/:id', authMiddleware, async (req, res) => {
    try {
        await Sale.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== TRANSFER ROUTES ====================

app.get('/api/transfers', authMiddleware, async (req, res) => {
    try {
        const transfers = await Transfer.find().sort({ createdAt: -1 });
        res.json(transfers);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/transfers', authMiddleware, async (req, res) => {
    try {
        const transfer = new Transfer({ ...req.body, processedBy: req.user.id });
        await transfer.save();
        res.status(201).json(transfer);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.delete('/api/transfers/:id', authMiddleware, async (req, res) => {
    try {
        await Transfer.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== CREATE DEFAULT ADMIN ====================

const createDefaultAdmin = async () => {
    try {
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
            console.log('✅ Default admin created - Username: admin, Password: Admin123!');
        }
    } catch (error) {
        console.log('Admin creation error:', error.message);
    }
};

// ==================== DATABASE CONNECTION ====================

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gambella_coffee_union';

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('✅ MongoDB connected');
        createDefaultAdmin();
    })
    .catch(err => console.error('MongoDB error:', err));

// ==================== SERVE FRONTEND ====================

// Serve login page at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve dashboard
app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Catch-all for other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});