require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const sequelize = require('./config/database');
const { User, Device, Alarm } = require('./models');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" },destroyUpgrade: false });


// Import Routes
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/device');
const monitorRoutes = require('./routes/monitor');
const settingRoutes = require('./routes/setting');
// const parameterRoutes = require('./routes/parameter');


// --- Middleware ---
// ขยาย limit เพื่อรองรับ Base64 จาก Jetson
app.use(express.json({ limit: '20mb' }));
app.use(cors());

// Add logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

app.use('/uploads', express.static('uploads'));

// ส่ง socket.io ไปให้ routes ใช้ผ่าน req.app.get('socketio')
app.set('socketio', io);
// --- Socket.io Connection ---
io.on('connection', (socket) => {
  socket.on('join-plant', (plantName) => {
    socket.join(plantName);
    // console.log(`Client joined plant room: ${plantName}`);
  });
  socket.on('register-device-status',async (data) => {
    const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
    const { apiKey } = parsedData;
    console.log(`Device attempting to register with API key: ${apiKey}`);
    try{
        const device = await Device.findOne({where:{apiKey}})
        if(device){
          socket.mcId = device.mcId;
          socket.join(device.plant);
        }

    } catch (error) {
      console.error('Error occurred while registering device status:', error);
    }
  });
  socket.on('heartbeat', async (stats) => {
    if (socket.mcId) {
      try {
        const parsedData = typeof stats === 'string' ? JSON.parse(stats) : stats;
        await Device.update({ ...parsedData, lastSeen: new Date() }, { where: { mcId: socket.mcId } });
        // console.log(`Received heartbeat from ${socket.mcId}:`, parsedData);

        // Notify UI clients in this plant room that a device status changed
        const device = await Device.findOne({ where: { mcId: socket.mcId } });
        if (device) {
          const payload = {
            mcId: device.mcId,
            runningStatus: device.runningStatus,
            lastSeen: device.lastSeen,
            plant: device.plant,
            zone: device.zone,
          };

          io.to(device.plant).emit('device-status', payload);
          io.to('ALL').emit('device-status', payload);
        }
      } catch (error) {
        console.error('Error occurred while updating device status:', error);
      }
    }
  });


  socket.on('disconnect', async () => {
    if (socket.mcId) {
      try {
        const device = await Device.findOne({ where: { mcId: socket.mcId } });
        await Device.update(
          { runningStatus: 'inactive' },
          { where: { mcId: socket.mcId } }
        );

        if (device) {
          const payload = {
            mcId: device.mcId,
            runningStatus: 'inactive',
            lastSeen: new Date(),
            plant: device.plant,
            zone: device.zone,
          };

          io.to(device.plant).emit('device-status', payload);
          io.to('ALL').emit('device-status', payload);
        }
      } catch (error) {
        console.error('Error occurred while updating device status:', error);
      }
    }
  });
});


// --- Test Route ---
app.get('/test', (req, res) => {
  res.json({ message: "API is working!" });
});

// --- Use Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/device', deviceRoutes);
app.use('/api/monitor', monitorRoutes);
app.use('/api/settings', settingRoutes);
// app.use('/api/parameters', parameterRoutes);



// --- Sync Database & Start Server ---
console.log('Starting database sync...');
sequelize.sync().then(async () => {
  console.log('Database sync completed.');
  // สร้างโฟลเดอร์ uploads ถ้ายังไม่มี
  if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');

  // ตรวจสอบ/สร้าง Admin เริ่มต้น
  const adminExists = await User.findOne({ where: { en: 'admin' } });
  if (!adminExists) {
    await User.create({
      en: 'admin',
      password: '1234',
      role: 'admin',
      plant: 'ALL',
      accessibleZones: 'ALL'
    });
    console.log("System Ready: Default Admin created.");
  }

  // รีเซ็ตสถานะเครื่องทั้งหมดให้เป็น inactive เมื่อเซิร์ฟเวอร์เพิ่งเริ่มทำงาน
  await Device.update({ runningStatus: 'inactive' }, { where: {} });

  const port = process.env.PORT || 3000;
  const host = process.env.HOST || '0.0.0.0';
  server.listen(port, host, () => console.log(`Backend System Running on http://${host}:${port}`));
}).catch(err => {
  console.error('Database sync failed:', err);
});
