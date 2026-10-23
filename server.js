const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']); 

const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ✅ የፊት ገጽ ፋይሎች በቀጥታ ከዚሁ ፎልደር እንዲነበቡ ማድረግ
app.use(express.static(__dirname));

// ==========================================
// 🔴 MongoDB Connection
// ==========================================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://gambella_admin:Admin1234@gammajmembers.di2ho2h.mongodb.net/gambella_coffee_union?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI)
.then(() => console.log('✅ MongoDB Connected Successfully'))
.catch(err => console.error('❌ MongoDB Connection Error:', err.message));

// ==========================================
// 🔴 Schemas
// ==========================================
// 1. Member Schema (ለአባላት መረጃ)
// 1. Member Schema (ሙሉ የአባል መረጃ)
const memberSchema = new mongoose.Schema({
    member_id: { type: String, required: true, unique: true },
    full_name: { type: String, required: true },
    password: { type: String, required: true },
    phone: { type: String, unique: true, sparse: true },
    gender: { type: String, default: 'ወንድ' },
    age: { type: Number, default: 0 },
    mother_name: { type: String, default: '' },
    nationality: { type: String, default: 'ኢትዮጵያዊ' },
    education: { type: String, default: '' },
    region: { type: String, default: '' },
    zone: { type: String, default: '' },
    district: { type: String, default: '' },
    city: { type: String, default: '' },
    kebele: { type: String, default: '' },
    house_number: { type: String, default: '' },
    tax_id: { type: String, default: '' },
    role: { type: String, default: 'አባል' },
    share_count: { type: Number, default: 0 },
    share_percentage: { type: String, default: '0%' },
    total_payable: { type: Number, default: 0 },
    share_price_paid: { type: Number, default: 0 },
    remaining_balance: { type: Number, default: 0 },
    payment_status: { type: String, default: 'አልተከፈለም' },
    year1_payment: { type: Number, default: 0 },
    year2_payment: { type: Number, default: 0 },
    year3_payment: { type: Number, default: 0 },
    bank_name: { type: String, default: '' },
    bank_branch: { type: String, default: '' },
    account_number: { type: String, default: '' },
    account_name: { type: String, default: '' },
    financial_notes: { type: String, default: '' },
    memberPhoto: { type: String, default: '' },
    memberTaxDoc: { type: String, default: '' },
    beneficiaries: { type: Array, default: [] },
    legalRepName: { type: String, default: '' },
    legalRepAddress: { type: String, default: '' },
    legalRepPhone: { type: String, default: '' },
    repPhoto: { type: String, default: '' },
    powerOfAttorneyType: { type: String, default: '' },
    powerOfAttorneyNumber: { type: String, default: '' },
    powerOfAttorneyDate: { type: String, default: '' },
    powerOfAttorneyIssuer: { type: String, default: '' },
    powerOfAttorneyExpiry: { type: String, default: '' },
    powerOfAttorneyNotes: { type: String, default: '' },
    powerOfAttorneyPhoto: { type: String, default: '' },
    hardCopyDocumentPhoto: { type: String, default: '' },
    hardCopyForm: { type: String, default: '' },
    created_at: { type: Date, default: Date.now }
});
const Member = mongoose.model('Member', memberSchema);

// 2. Admin Schema (ለአድሚን መግቢያ)
const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    created_at: { type: Date, default: Date.now }
});
const Admin = mongoose.model('Admin', adminSchema);

// 3. Product Schema (ለግብይት ገጽ)
const productSchema = new mongoose.Schema({
    title: { type: String, required: true },
    price: { type: String, required: true },
    category: { type: String, required: true },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    seller_name: { type: String, default: 'GMFC Admin' },
    createdAt: { type: Date, default: Date.now }
});
const Product = mongoose.model('Product', productSchema);

// 4. News Schema (ለዜና)
const newsSchema = new mongoose.Schema({
    year: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    image: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});
const News = mongoose.model('News', newsSchema);

// ==========================================
// 🔴 API ROUTES
// ==========================================

// --- Admin Login ---
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        let admin = await Admin.findOne({ username });
        
        // መጀመሪያ ሲገባ አድሚን ከሌለ በራሱ ይፈጥራል
        if (!admin && username === 'admin' && password === 'admin123') {
            admin = new Admin({ username: 'admin', password: 'admin123' });
            await admin.save();
            return res.json({ success: true, token: 'dummy-token', user: { username: 'admin' } });
        }

        if (!admin || admin.password !== password) {
            return res.status(401).json({ error: "Invalid username or password" });
        }

        res.json({ success: true, token: 'dummy-token', user: { username: admin.username } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Member Login (ለአባላት ፖርታል) ---
app.post('/api/login', async (req, res) => {
    try {
        const { member_id, password } = req.body;
        const member = await Member.findOne({ member_id, password });
        if (!member) return res.status(401).json({ error: "Invalid Member ID or Password" });
        res.json({ success: true, user: member });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Get All Members (ለካርድ ሰሪ እና አድሚን) ---
// --- Get All Members (ለካርድ ሰሪ እና አድሚን) ---
app.get('/api/members', async (req, res) => {
    try {
        // ✅ የሚፈለጉትን መስኮች ብቻ መርጠን እናውጣ (ፎቶዎችን ሳይጨምር)
        const members = await Member.find().select('full_name fullName member_id memberId phone share_count role');
        res.json(members);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Add New Member (አዲስ አባል መመዝገቢያ) ---
app.post('/api/members', async (req, res) => {
    try {
        const { member_id, full_name, password } = req.body;
        
        if (!member_id || !full_name || !password) {
            return res.status(400).json({ error: "member_id, full_name and password are required" });
        }
        
        const existing = await Member.findOne({ member_id });
        if (existing) {
            return res.status(400).json({ error: "Member ID already exists" });
        }
        
        const newMember = new Member(req.body);
        await newMember.save();
        res.json({ success: true, message: "Member registered successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Products (ለግብይት ገጽ) ---
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.json(products);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/products', async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        await newProduct.save();
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- News (ዜና) ---
app.get('/api/news', async (req, res) => {
    try {
        const news = await News.find().sort({ createdAt: -1 });
        res.json(news);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/news', async (req, res) => {
    try {
        const newNews = new News(req.body);
        await newNews.save();
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// ==========================================
// 🔴 Frontend Catch-all (ማንኛውም ያልተገኘ ገጽ ወደ index.html እንዲሄድ)
// ==========================================
// ✅ ከ app.get('*') ወደ app.use() ተቀይሯል (Express 5 ላይ ችግር እንዳያመጣ)
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    // ✅ የጎደለው የባክቲክ ምልክት (`) ተጨምሯል
    console.log(`🚀 Server running on port ${PORT}`);
});
