const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static HTML files from root directory
app.use(express.static(__dirname));

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'gambella-secret-key-2024';

// ==================== MONGODB MODELS ====================

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    fullName: { type: String, required: true },
    role: { type: String, default: 'staff' },
    isActive: { type: Boolean, default: true },
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
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
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
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

const Sale = mongoose.model('Sale', SaleSchema);

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
        
        const user = await User.findOne({ username });
        if (!user) {
            console.log('User not found:', username);
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log('Password incorrect for:', username);
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { id: user._id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        console.log('Login successful:', username);
        res.json({
            success: true,
            token,
            user: {
                id: user._id,
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
app.get('/api/auth/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET ALL MEMBERS
app.get('/api/members', authMiddleware, async (req, res) => {
    try {
        const members = await Member.find().sort({ createdAt: -1 });
        res.json(members);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// CREATE MEMBER
app.post('/api/members', authMiddleware, async (req, res) => {
    try {
        const member = new Member({ ...req.body, createdBy: req.user.id });
        await member.save();
        res.status(201).json(member);
    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// DELETE MEMBER
app.delete('/api/members/:id', authMiddleware, async (req, res) => {
    try {
        await Member.findByIdAndDelete(req.params.id);
        res.json({ message: 'Member deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// SEARCH MEMBERS
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

// GET ALL SALES
app.get('/api/sales', authMiddleware, async (req, res) => {
    try {
        const sales = await Sale.find().populate('memberId', 'fullName phone').sort({ date: -1 });
        res.json(sales);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// CREATE SALE
app.post('/api/sales', authMiddleware, async (req, res) => {
    try {
        const sale = new Sale({ ...req.body, recordedBy: req.user.id });
        await sale.save();
        res.status(201).json(sale);
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
            console.log('✅ Default admin created!');
            console.log('   Username: admin');
            console.log('   Password: Admin123!');
        } else {
            console.log('✅ Admin user already exists');
        }
    } catch (error) {
        console.error('Admin creation error:', error.message);
    }
};

// ==================== DATABASE CONNECTION ====================

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gambella_coffee_union';

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('✅ MongoDB connected successfully');
        createDefaultAdmin();
    })
    .catch(err => {
        console.error('❌ MongoDB connection error:', err.message);
        console.log('⚠️  Make sure MongoDB is running!');
    });

// ==================== SERVE FRONTEND ====================

// Login page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Dashboard page
app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Catch-all for any other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📱 Login at: http://localhost:${PORT}`);
    console.log(`👤 Default: admin / Admin123!`);
});
