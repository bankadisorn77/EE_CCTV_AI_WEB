const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { verifyToken } = require('../middleware/auth');

// ใช้กุญแจดอกเดียวจาก .env ที่คุณตั้งไว้
const SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// 1. LOGIN (ออกทั้ง Access และ Refresh)
router.post('/login', async (req, res) => {
  try {
    console.log("--> Login attempt received for:", req.body.en);
    const { en, password } = req.body;
    const user = await User.findOne({ where: { en } });
    console.log("--> User query completed. Found:", user ? "Yes" : "No");
    
    if (user && await bcrypt.compare(password, user.password)) {
      console.log("--> Password matched. Generating tokens...");
      // Access Token: สั้น (15 นาที) เพื่อความปลอดภัย
      const accessToken = jwt.sign(
        { id: user.id, en: user.en, role: user.role, plant: user.plant },
        SECRET, { expiresIn: '15m' }
      );
      // Refresh Token: ยาว (7 วัน) สำหรับขอ Access Token ใหม่
      const refreshToken = jwt.sign({ id: user.id }, SECRET, { expiresIn: '7d' });

      // เซฟลง DB (ต้องมั่นใจว่า Model User มีฟิลด์ refreshToken: DataTypes.TEXT นะครับ)
      await user.update({ refreshToken });

      res.json({ accessToken, refreshToken,en: user.en, role: user.role, plant: user.plant });
    } else {
      res.status(401).json({ error: "Invalid EN or Password" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. REFRESH TOKEN (จุดที่ใช้ขอกุญแจใหม่)
router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: "Required" });

    const user = await User.findOne({ where: { refreshToken } });
    if (!user) return res.status(403).json({ error: "Invalid Token" });

    // ตรวจสอบความถูกต้อง/วันหมดอายุ
    jwt.verify(refreshToken, SECRET, (err) => {
      if (err) return res.status(403).json({ error: "Expired or Invalid" });
      console.log(`access new token for ${user.en}`);
      // ออก Access Token ชุดใหม่
      const newAccessToken = jwt.sign(
        { id: user.id, en: user.en, role: user.role, plant: user.plant },
        SECRET, { expiresIn: '15m' }
      );
      res.json({ accessToken: newAccessToken });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/register', verifyToken, async (req, res) => {
  try {
    req.body.role = req.body.role.trim().toLowerCase(); // ทำให้แน่ใจว่า role ที่ส่งมาเป็นตัวพิมพ์เล็ก
    req.body.plant = req.body.plant.trim().toLowerCase(); // ทำให้แน่ใจว่า plant ที่ส่งมาเป็นตัวพิมพ์เล็ก

    const { role: rRole, plant: rPlant } = req.user; // ข้อมูลคนสั่ง (จาก Token)
    const { en, password, role: tRole, plant: tPlant } = req.body; // ข้อมูลที่จะสร้าง

    // 1. ถ้าเป็น ADMIN: สร้างได้ทุกอย่าง (Admin, Engineer, User) ในทุก Plant
    
    if (rRole === 'admin') {
      await User.create({ en, password: password, role: tRole, plant: tRole === 'admin' ? 'ALL' : tPlant, accessibleZones: 'ALL' });
      return res.status(201).json({ message: "Admin created user successfully" });
    }

    // 2. ถ้าเป็น ENGINEER:
    if (rRole === 'engineer') {
      // ตรวจสอบว่าพยายามสร้างบทบาทอื่นที่ไม่ใช่ 'user' หรือไม่
      if (tRole !== 'user') {
        return res.status(403).json({ error: "Engineers can only create 'user' accounts." });
      }

      // ตรวจสอบว่า Plant ที่ส่งมาใน Body ตรงกับ Plant ของตัว Engineer เองไหม
      // ถ้าไม่ส่งมา หรือส่งมาผิด -> ปฏิเสธการสร้าง
      if (tPlant !== rPlant) {
        return res.status(403).json({ error: `Permission denied. You can only create users for ${rPlant}` });
      }

      await User.create({ 
        en, 
        password: password,
        role: 'user', 
        plant: rPlant, 
        accessibleZones: 'ALL' 
      });
      return res.status(201).json({ message: "Engineer created user successfully" });
    }

    // 3. บทบาทอื่นๆ (เช่น User) ไม่มีสิทธิ์สร้างใคร
    res.status(403).json({ error: "No permission to create accounts." });

  } catch (err) {
    res.status(400).json({ error: err.message });
    console.error(err); 
  }
});

// 4. UPDATE USER ZONES (Admin แก้ได้หมด / Engineer แก้ได้เฉพาะคนใน Plant ตัวเอง)
router.put('/user/:en/zones', verifyToken, async (req, res) => {
  try {
    const { role: rRole, plant: rPlant } = req.user; // ผู้สั่งการ
    const { accessibleZones } = req.body; // โซนใหม่ที่จะส่งมา เช่น "Zone A, Zone B"
    const targetEn = req.params.en;

    // ค้นหา User เป้าหมายที่ต้องการจะแก้
    const targetUser = await User.findOne({ where: { en: targetEn } });

    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // --- เช็คสิทธิ์การแก้ไข ---
    
    // เคสที่ 1: เป็น Admin (แก้ได้ทุกคน ทุก Plant)
    if (rRole === 'admin') {
      await targetUser.update({ accessibleZones });
      return res.json({ message: `Admin updated zones for ${targetEn}` });
    }

    // เคสที่ 2: เป็น Engineer
    if (rRole === 'engineer') {
      // ต้องอยู่ Plant เดียวกันเท่านั้นถึงจะแก้ได้
      if (targetUser.plant !== rPlant) {
        return res.status(403).json({ error: "Forbidden: User is in a different plant" });
      }
      
      await targetUser.update({ accessibleZones });
      return res.json({ message: `Engineer updated zones for ${targetEn}` });
    }

    // เคสอื่นๆ
    res.status(403).json({ error: "No permission to update zones" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. LOGOUT
router.post('/logout', verifyToken, async (req, res) => {
  try {
    // ลบ Token ใน DB เพื่อความปลอดภัย
    await User.update({ refreshToken: null }, { where: { id: req.user.id } });
    res.json({ message: "Logged out" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;