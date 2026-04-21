const jwt = require('jsonwebtoken');
const { Device } = require('../models');


const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

// ตรวจสอบ JWT สำหรับคน (Admin, Engineer, User)
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: "Access Denied" });
  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ error: "Invalid Token" });
  }
};

// ตรวจสอบ API Key สำหรับ Jetson Device
const verifyApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(401).json({ error: "No API Key provided" });

  const device = await Device.findOne({ where: { apiKey } });
  if (!device) return res.status(403).json({ error: "Invalid API Key" });

  req.device = device;
  next();
};

module.exports = { verifyToken, verifyApiKey };