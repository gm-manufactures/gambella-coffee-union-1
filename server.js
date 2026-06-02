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
    memberId: { type: String, unique: true, sparse: true },
    fullName: { type: String, required: true },
    gender: { type: String, required: true },
    age: { type: Number, required: true },
    motherName: { type: String, required: true },
    nationality: { type: String, default: 'ኢትዮጵያዊ' },
    education: { type: String, default: '' },
    address: { type: String, default: '' },
    region: { type: String, default: '' },
    zone: { type: String, default: '' },
    district: { type: String, default: '' },
    city: { type: String, default: '' },
    kebele: { type: String, default: '' },
    houseNumber: { type: String, default: '' },
    phone: { type: String, required: true, unique: true },
    taxId: { type: String, default: '' },
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
    bankName: { type: String, default: '' },
    bankBranch: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    accountName: { type: String, default: '' },
    financialNotes: { type: String, default: '' },
    beneficiaries: { type: Array, default: [] },
    beneficiaryCount: { type: Number, default: 0 },
    legalRepName: { type: String, default: '' },
    legalRepAddress: { type: String, default: '' },
    legalRepPhone: { type: String, default: '' },
    powerOfAttorneyType: { type: String, default: '' },
    powerOfAttorneyNumber: { type: String, default: '' },
    powerOfAttorneyDate: { type: String, default: '' },
    powerOfAttorneyIssuer: { type: String, default: '' },
    powerOfAttorneyExpiry: { type: String, default: '' },
    powerOfAttorneyNotes: { type: String, default: '' },
    memberPhoto: { type: String, default: null },
    memberTaxDoc: { type: String, default: null },
    repPhoto: { type: String, default: null },
    repTaxDoc: { type: String, default: null },
    hardCopyForm: { type: String, default: null },
    powerOfAttorneyPhoto: { type: String, default: null },
    hardCopyDocumentPhoto: { type: String, default: null },
    createdBy: { type: String, default: '' },
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

// Generate random password
function generateRandomPassword() {
    return "1234";
}

// Generate unique Member ID (GMFC/YYYY/XXXX format)
async function generateMemberId() {
    const currentYear = new Date().getFullYear();
    // Generate 4-digit random number (1000 to 9999)
    const randomNum = Math.floor(Math.random() * 9000) + 1000;
    
    const memberId = `GMFC/${currentYear}/${randomNum}`;
    
    // Check if ID already exists (rare but possible)
    const existing = await Member.findOne({ memberId: memberId });
    if (existing) {
        // Recursively generate a new one
        return generateMemberId();
    }
    
    return memberId;
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
        
        if (!await user.comparePassword(password)) {
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
            user: { id: user._id, username: user.username, fullName: user.fullName, role: user.role }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/auth/member-login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const user = await User.findOne({ username, role: 'member' });
        if (!user) return res.status(401).json({ message: 'Invalid credentials' });
        
        if (!await user.comparePassword(password)) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { id: user._id, username: user.username, role: user.role, memberId: user.memberId },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        res.json({
            success: true,
            token,
            user: { id: user._id, username: user.username, fullName: user.fullName, role: user.role, memberId: user.memberId }
        });
    } catch (error) {
        console.error('Member login error:', error);
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
        console.error('Update profile error:', error);
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
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    user.password = newPassword;
    await user.save();
    
    res.json({ success: true });
});

// ==================== MEMBER REGISTRATION ROUTE ====================

app.post('/api/members/register', async (req, res) => {
    console.log("=".repeat(60));
    console.log("📝 NEW MEMBER REGISTRATION");
    console.log("=".repeat(60));
    
    try {
        // Remove any id fields
        const { id, _id, ...cleanData } = req.body;
        
        // Validate required fields
        const requiredFields = ['fullName', 'gender', 'age', 'motherName', 'phone', 'role'];
        const missingFields = requiredFields.filter(field => !cleanData[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingFields.join(', ')}`
            });
        }
        
        // Check if phone already exists
        const existingMember = await Member.findOne({ phone: cleanData.phone });
        if (existingMember) {
            return res.status(400).json({
                success: false,
                message: `Phone number ${cleanData.phone} is already registered. Please use a DIFFERENT phone number.`,
                field: 'phone'
            });
        }
        
        // Generate UNIQUE Member ID (GMFC/2026/5823 format)
        const generatedMemberId = await generateMemberId();
        console.log("📛 Generated Member ID:", generatedMemberId);
        
        // Username is the FULL Member ID
        const username = generatedMemberId;
        const plainPassword = "1234";
        
        // Check if username already exists
        let finalUsername = username;
        let counter = 1;
        let existingUser = await User.findOne({ username: finalUsername });
        while (existingUser) {
            finalUsername = `${username}-${counter}`;
            existingUser = await User.findOne({ username: finalUsername });
            counter++;
        }
        
        // Build address
        let address = cleanData.address || '';
        if (!address) {
            const addressParts = [
                cleanData.region, cleanData.zone, cleanData.district,
                cleanData.city, cleanData.kebele, cleanData.houseNumber
            ].filter(part => part && part.trim() !== '');
            address = addressParts.join(', ');
        }
        
        // Calculate financial values
        const shareCount = parseInt(cleanData.shareCount) || 0;
        const sharePricePaid = parseFloat(cleanData.sharePricePaid) || 0;
        const totalPayable = shareCount * 10000;
        const remainingBalance = totalPayable - sharePricePaid;
        
        let paymentStatus = 'አልተከፈለም';
        if (remainingBalance <= 0) paymentStatus = 'ተከፍሏል';
        else if (sharePricePaid > 0) paymentStatus = 'በከፊል ተከፍሏል';
        
        let bankName = cleanData.bankName || '';
        if (bankName === 'ሌላ' && cleanData.otherBankName) {
            bankName = cleanData.otherBankName;
        }
        
        // Create member with custom memberId
        const memberData = {
            memberId: generatedMemberId,
            fullName: cleanData.fullName,
            gender: cleanData.gender,
            age: parseInt(cleanData.age) || 0,
            motherName: cleanData.motherName,
            nationality: cleanData.nationality || 'ኢትዮጵያዊ',
            education: cleanData.education || '',
            address: address,
            region: cleanData.region || '',
            zone: cleanData.zone || '',
            district: cleanData.district || '',
            city: cleanData.city || '',
            kebele: cleanData.kebele || '',
            houseNumber: cleanData.houseNumber || '',
            phone: cleanData.phone,
            taxId: cleanData.taxId || '',
            role: cleanData.role,
            shareCount: shareCount,
            sharePercentage: shareCount > 0 ? (shareCount / 25000) * 100 : 0,
            sharePrice: 10000,
            totalPayable: totalPayable,
            sharePricePaid: sharePricePaid,
            remainingBalance: remainingBalance,
            paymentStatus: paymentStatus,
            year1Payment: totalPayable * 0.3,
            year2Payment: totalPayable * 0.4,
            year3Payment: totalPayable * 0.3,
            bankName: bankName,
            bankBranch: cleanData.bankBranch || '',
            accountNumber: cleanData.accountNumber || '',
            accountName: cleanData.accountName || '',
            financialNotes: cleanData.financialNotes || '',
            beneficiaries: cleanData.beneficiaries || [],
            beneficiaryCount: (cleanData.beneficiaries || []).length,
            legalRepName: cleanData.legalRepName || '',
            legalRepAddress: cleanData.legalRepAddress || '',
            legalRepPhone: cleanData.legalRepPhone || '',
            powerOfAttorneyType: cleanData.powerOfAttorneyType || '',
            powerOfAttorneyNumber: cleanData.powerOfAttorneyNumber || '',
            powerOfAttorneyDate: cleanData.powerOfAttorneyDate || '',
            powerOfAttorneyIssuer: cleanData.powerOfAttorneyIssuer || '',
            powerOfAttorneyExpiry: cleanData.powerOfAttorneyExpiry || '',
            powerOfAttorneyNotes: cleanData.powerOfAttorneyNotes || '',
            memberPhoto: cleanData.memberPhoto || null,
            memberTaxDoc: cleanData.memberTaxDoc || null,
            repPhoto: cleanData.repPhoto || null,
            repTaxDoc: cleanData.repTaxDoc || null,
            hardCopyForm: cleanData.hardCopyForm || null,
            powerOfAttorneyPhoto: cleanData.powerOfAttorneyPhoto || null,
            hardCopyDocumentPhoto: cleanData.hardCopyDocumentPhoto || null,
            createdBy: cleanData.createdBy || 'system',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        const newMember = new Member(memberData);
        await newMember.save();
        console.log(`✅ Member saved! Member ID: ${newMember.memberId}`);
        
        // Create user account with FULL Member ID as username
        const email = `${finalUsername.replace(/\//g, '_')}@member.gambella.com`;
        
        const newUser = new User({
            username: finalUsername,
            email: email,
            password: plainPassword,
            fullName: newMember.fullName,
            role: 'member',
            memberId: newMember._id.toString(),
            isActive: true
        });
        
        await newUser.save();
        console.log(`✅ User created! Username: ${finalUsername}, Password: ${plainPassword}`);
        
        // Send response
        res.status(201).json({
            success: true,
            message: 'Member registered successfully!',
            member: {
                id: newMember._id,
                memberId: newMember.memberId,
                fullName: newMember.fullName,
                phone: newMember.phone,
                shareCount: newMember.shareCount
            },
            credentials: {
                username: finalUsername,
                password: plainPassword,
                memberId: newMember.memberId
            }
        });
        
    } catch (error) {
        console.error('❌ Registration error:', error);
        
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({
                success: false,
                message: `${field} already exists. Please use a different ${field}.`,
                field: field
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
});

// ==================== GET ALL MEMBERS ====================

app.get('/api/members', authMiddleware, async (req, res) => {
    try {
        const members = await Member.find().sort({ createdAt: -1 });
        console.log(`📋 Retrieved ${members.length} members`);
        res.json(members);
    } catch (error) {
        console.error('Error fetching members:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// ==================== GET SINGLE MEMBER ====================

app.get('/api/members/:id', authMiddleware, async (req, res) => {
    try {
        const member = await Member.findById(req.params.id);
        if (!member) return res.status(404).json({ message: 'Member not found' });
        
        if (req.user.role === 'member' && req.user.memberId !== req.params.id) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        res.json(member);
    } catch (error) {
        console.error('Error fetching member:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== GET MEMBER BY MEMBER ID ====================

app.get('/api/members/by-memberid/:memberId', authMiddleware, async (req, res) => {
    try {
        const member = await Member.findOne({ memberId: req.params.memberId });
        if (!member) return res.status(404).json({ message: 'Member not found' });
        res.json(member);
    } catch (error) {
        console.error('Error fetching member:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== UPDATE MEMBER ====================

app.put('/api/members/:id', authMiddleware, async (req, res) => {
    console.log("✏️ UPDATE MEMBER REQUEST");
    console.log("Member ID:", req.params.id);
    
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Admin only. You do not have permission to update members.'
            });
        }
        
        const { _id, id, createdAt, __v, ...updateData } = req.body;
        updateData.updatedAt = new Date();
        
        const member = await Member.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true, runValidators: true }
        );
        
        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }
        
        console.log(`✅ Member updated: ${member.fullName}`);
        res.json({ success: true, message: 'Member updated successfully', member: member });
        
    } catch (error) {
        console.error('❌ Update error:', error);
        
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({
                success: false,
                message: `${field} already exists. Please use a different value.`,
                field: field
            });
        }
        
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

// ==================== DELETE MEMBER ====================

app.delete('/api/members/:id', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }
        
        await Member.findByIdAndDelete(req.params.id);
        await User.findOneAndDelete({ memberId: req.params.id });
        
        res.json({ message: 'Member deleted successfully' });
    } catch (error) {
        console.error('Error deleting member:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== SEARCH MEMBERS ====================

app.get('/api/members/search/:query', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }
        
        const q = req.params.query;
        const members = await Member.find({
            $or: [
                { fullName: { $regex: q, $options: 'i' } },
                { phone: { $regex: q, $options: 'i' } },
                { memberId: { $regex: q, $options: 'i' } }
            ]
        });
        
        res.json(members);
    } catch (error) {
        console.error('Error searching members:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== MEMBER COUNT ====================

app.get('/api/members/count', authMiddleware, async (req, res) => {
    try {
        const count = await Member.countDocuments();
        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== GET MY PROFILE ====================

app.get('/api/members/profile/my', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'member' || !req.user.memberId) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        const member = await Member.findById(req.user.memberId);
        if (!member) return res.status(404).json({ message: 'Member not found' });
        
        res.json(member);
    } catch (error) {
        console.error('Error fetching member profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== SALE ROUTES ====================

app.get('/api/sales', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }
        const sales = await Sale.find().sort({ date: -1 });
        res.json(sales);
    } catch (error) {
        console.error('Error fetching sales:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/sales/member/:memberId', authMiddleware, async (req, res) => {
    try {
        if (req.user.role === 'member' && req.user.memberId !== req.params.memberId) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        const sales = await Sale.find({ memberId: req.params.memberId }).sort({ date: -1 });
        res.json(sales);
    } catch (error) {
        console.error('Error fetching member sales:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/sales', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }
        
        const sale = new Sale(req.body);
        await sale.save();
        res.status(201).json(sale);
    } catch (error) {
        console.error('Error adding sale:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

app.delete('/api/sales/:id', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }
        
        await Sale.findByIdAndDelete(req.params.id);
        res.json({ message: 'Sale deleted' });
    } catch (error) {
        console.error('Error deleting sale:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== TRANSFER ROUTES ====================

app.get('/api/transfers', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }
        const transfers = await Transfer.find().sort({ createdAt: -1 });
        res.json(transfers);
    } catch (error) {
        console.error('Error fetching transfers:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/transfers', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }
        
        const transfer = new Transfer(req.body);
        await transfer.save();
        res.status(201).json(transfer);
    } catch (error) {
        console.error('Error adding transfer:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

app.delete('/api/transfers/:id', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }
        
        await Transfer.findByIdAndDelete(req.params.id);
        res.json({ message: 'Transfer deleted' });
    } catch (error) {
        console.error('Error deleting transfer:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== TRADING ROUTES ====================

app.post('/api/share-trading/request', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'member') {
            return res.status(403).json({ message: 'Members only' });
        }
        
        const { requestType, shareAmount, pricePerShare = 10000, notes } = req.body;
        
        if (!requestType || !shareAmount || shareAmount <= 0) {
            return res.status(400).json({ message: 'Invalid request' });
        }
        
        const member = await Member.findById(req.user.memberId);
        if (!member) return res.status(404).json({ message: 'Member not found' });
        
        if (requestType === 'sell' && (member.shareCount || 0) < shareAmount) {
            return res.status(400).json({ 
                message: `Insufficient shares. You have only ${member.shareCount || 0} shares.`
            });
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
    } catch (error) {
        console.error('Error creating trading request:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

app.get('/api/share-trading/my-requests', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'member') {
            return res.status(403).json({ message: 'Members only' });
        }
        
        const requests = await TradingRequest.find({ memberId: req.user.memberId }).sort({ createdAt: -1 });
        res.json(requests);
    } catch (error) {
        console.error('Error fetching my requests:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/share-trading/requests', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }
        
        const requests = await TradingRequest.find().sort({ createdAt: -1 });
        res.json(requests);
    } catch (error) {
        console.error('Error fetching all requests:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/share-trading/pending', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }
        
        const requests = await TradingRequest.find({ status: 'pending' }).sort({ createdAt: -1 });
        res.json(requests);
    } catch (error) {
        console.error('Error fetching pending requests:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/share-trading/approve/:id', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }
        
        const request = await TradingRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ message: 'Request not found' });
        
        if (request.status !== 'pending') {
            return res.status(400).json({ message: 'Request already processed' });
        }
        
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
    } catch (error) {
        console.error('Error approving request:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

app.post('/api/share-trading/reject/:id', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin only' });
        }
        
        const request = await TradingRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ message: 'Request not found' });
        
        if (request.status !== 'pending') {
            return res.status(400).json({ message: 'Request already processed' });
        }
        
        request.status = 'rejected';
        request.processedBy = req.user.id;
        request.processedAt = new Date();
        request.rejectionReason = req.body.reason || 'No reason provided';
        await request.save();
        
        res.json({ success: true, message: 'Request rejected' });
    } catch (error) {
        console.error('Error rejecting request:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/share-trading/stats', authMiddleware, async (req, res) => {
    try {
        const members = await Member.find();
        const requests = await TradingRequest.find();
        
        const totalShares = members.reduce((sum, m) => sum + (m.shareCount || 0), 0);
        const pendingRequests = requests.filter(r => r.status === 'pending').length;
        const approvedRequests = requests.filter(r => r.status === 'approved').length;
        const totalBuyShares = requests.filter(r => r.requestType === 'buy').reduce((sum, r) => sum + r.shareAmount, 0);
        const totalSellShares = requests.filter(r => r.requestType === 'sell').reduce((sum, r) => sum + r.shareAmount, 0);
        
        res.json({ totalShares, pendingRequests, approvedRequests, totalBuyShares, totalSellShares });
    } catch (error) {
        console.error('Error fetching trading stats:', error);
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
        console.error('Error creating admin:', error);
    }
};

// ==================== SERVE FRONTEND ====================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
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

app.get('/member_card.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'member_card.html'));
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 10000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gambella_coffee_union';

console.log('🚀 Starting server...');
console.log(`📡 Port: ${PORT}`);

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('✅ MongoDB connected successfully');
        console.log(`📊 Database: ${mongoose.connection.name}`);
        console.log(`📍 Host: ${mongoose.connection.host}`);
        
        await createDefaultAdmin();
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log('='.repeat(50));
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📱 Admin Login: http://localhost:${PORT}`);
            console.log(`👤 Username: admin`);
            console.log(`🔐 Password: Admin123!`);
            console.log('='.repeat(50));
        });
    })
    .catch(err => {
        console.error('❌ MongoDB connection error:', err.message);
        process.exit(1);
    });
