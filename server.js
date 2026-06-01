// ==================== MEMBER REGISTRATION ROUTE (FIXED) ====================

app.post('/api/members/register', async (req, res) => {
    console.log("=".repeat(60));
    console.log("📝 NEW MEMBER REGISTRATION");
    console.log("=".repeat(60));
    console.log("Full Name:", req.body.fullName);
    console.log("Phone:", req.body.phone);
    
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
            console.log("❌ Phone already exists:", cleanData.phone);
            return res.status(400).json({
                success: false,
                message: `Phone number ${cleanData.phone} is already registered. Please use a DIFFERENT phone number.`,
                field: 'phone'
            });
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
        
        // Create member
        const memberData = {
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
        console.log(`✅ Member saved! ID: ${newMember._id}`);
        
        // ========== CREATE UNIQUE USERNAME ==========
        // Generate username from name (remove spaces, take first 6 chars + phone suffix)
        let baseUsername = newMember.fullName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')  // Remove non-alphanumeric
            .substring(0, 6);
        if (baseUsername.length < 3) baseUsername = 'member';
        
        const phoneSuffix = newMember.phone.slice(-4);
        let username = `${baseUsername}${phoneSuffix}`;
        
        // Ensure username is unique
        let counter = 1;
        let existingUser = await User.findOne({ username: username });
        while (existingUser) {
            username = `${baseUsername}${phoneSuffix}${counter}`;
            existingUser = await User.findOne({ username: username });
            counter++;
        }
        
        // FIXED: Set password to "1234" for all members
        const plainPassword = "1234";
        
        // Create unique email
        const email = `${newMember.phone}@member.gambella.com`;
        
        // Create user account
        const newUser = new User({
            username: username,
            email: email,
            password: plainPassword,
            fullName: newMember.fullName,
            role: 'member',
            memberId: newMember._id.toString(),
            isActive: true
        });
        
        await newUser.save();
        console.log(`✅ User account created!`);
        console.log(`   Username: ${username}`);
        console.log(`   Password: ${plainPassword}`);
        
        // Send response with credentials
        res.status(201).json({
            success: true,
            message: 'Member registered successfully!',
            member: {
                id: newMember._id,
                fullName: newMember.fullName,
                phone: newMember.phone,
                shareCount: newMember.shareCount
            },
            credentials: {
                username: username,
                password: plainPassword
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
