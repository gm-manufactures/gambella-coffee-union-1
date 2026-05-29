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
const JWT_SECRET = 'gambella-secret-key-2024';

// ==================== MONGODB CONNECTION ====================

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not set!');
    process.exit(1);
}

console.log('🔄 Connecting to MongoDB...');

// ==================== SCHEMAS ====================

// User Schema
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    fullName: { type: String, required: true },
    role: { type: String, default: 'staff' },
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
    phone: { type: String, required: true, unique: true },
    taxId: { type: String },
    role: { type: String, required: true },
    shareCount: { type: Number, default: 0 },
    sharePercentage: { type: Number, default: 0 },
    sharePricePaid: { type: Number, default: 0 },
    remainingBalance: { type: Number, default: 0 },
    paymentStatus: { type: String, default: 'አልተከፈለም' },
    bankAccountNumber: { type: String },
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
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Member = mongoose.model('Member', MemberSchema);

// Sale Schema
const SaleSchema = new mongoose.Schema({
    memberId: { type: String, required: true },
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

app.post('/api/auth/login', async (req, res) => {
    console.log("Login attempt:", req.body.username);
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username, role: 'admin' });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        user.lastLogin = new Date();
        await user.save();
        
        const token = jwt.sign(
            { id: user._id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                username: user.username,
                fullName: user.fullName,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== MEMBER ROUTES ====================

app.post('/api/members/register', async (req, res) => {
    console.log("=".repeat(50));
    console.log("📝 Registration request received");
    console.log("Name:", req.body.fullName);
    console.log("Phone:", req.body.phone);
    console.log("=".repeat(50));
    
    try {
        // Validate required fields
        if (!req.body.fullName || !req.body.phone || !req.body.address) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        
        // Check if phone already exists
        const existingMember = await Member.findOne({ phone: req.body.phone });
        if (existingMember) {
            console.log("❌ Phone already exists:", req.body.phone);
            return res.status(400).json({ message: 'Phone number already registered' });
        }
        
        // Create new member
        const newMember = new Member({
            fullName: req.body.fullName,
            gender: req.body.gender || 'ወንድ',
            age: parseInt(req.body.age) || 0,
            motherName: req.body.motherName || '',
            nationality: req.body.nationality || 'ኢትዮጵያዊ',
            education: req.body.education || '',
            address: req.body.address,
            phone: req.body.phone,
            taxId: req.body.taxId || '',
            role: req.body.role || 'Member',
            shareCount: parseInt(req.body.shareCount) || 0,
            sharePercentage: parseFloat(req.body.sharePercentage) || 0,
            sharePricePaid: parseFloat(req.body.sharePricePaid) || 0,
            remainingBalance: (parseInt(req.body.shareCount) || 0) * 10000 - (parseFloat(req.body.sharePricePaid) || 0),
            paymentStatus: req.body.paymentStatus || 'አልተከፈለም',
            bankAccountNumber: req.body.bankAccountNumber || '',
            financialNotes: req.body.financialNotes || '',
            beneficiaries: req.body.beneficiaries || [],
            legalRepName: req.body.legalRepName || '',
            legalRepAddress: req.body.legalRepAddress || '',
            legalRepPhone: req.body.legalRepPhone || '',
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        await newMember.save();
        console.log("✅ Member saved to MongoDB!");
        console.log("   ID:", newMember._id);
        console.log("   Name:", newMember.fullName);
        
        // Generate credentials for member portal
        const username = generateUsername(newMember.fullName, newMember.phone);
        const plainPassword = generateRandomPassword();
        
        // Create user account for member
        const existingUser = await User.findOne({ username });
        if (!existingUser) {
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
            console.log("✅ User account created:", username);
            console.log("   Password:", plainPassword);
        }
        
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
        console.error("❌ Registration error:", error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

app.get('/api/members', authMiddleware, async (req, res) => {
    try {
        const members = await Member.find().sort({ createdAt: -1 });
        res.json(members);
    } catch (error) {
        console.error("Error fetching members:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/members/count', authMiddleware, async (req, res) => {
    try {
        const count = await Member.countDocuments();
        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/members/profile/my', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'member' || !req.user.memberId) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const member = await Member.findById(req.user.memberId);
        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }
        res.json(member);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.delete('/api/members/:id', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }
        await Member.findByIdAndDelete(req.params.id);
        await User.findOneAndDelete({ memberId: req.params.id });
        res.json({ message: 'Member deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== SALES ROUTES ====================

app.post('/api/sales', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }
        const sale = new Sale(req.body);
        await sale.save();
        res.status(201).json(sale);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/sales', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }
        const sales = await Sale.find().sort({ date: -1 });
        res.json(sales);
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
        console.error('Admin creation error:', error);
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

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 10000;

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('✅ MongoDB connected successfully');
        await createDefaultAdmin();
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📱 URL: http://localhost:${PORT}`);
            console.log(`👤 Admin Login: admin / Admin123!`);
        });
    })
    .catch(err => {
        console.error('❌ MongoDB connection error:', err.message);
        process.exit(1);
    });
