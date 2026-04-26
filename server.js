const WebSocket = require('ws');

const server = new WebSocket.Server({ port: 8080 });

const state = {
  lights: {
    teras: false,
    ruangTamu: true,
    kamar1: false,
    kamar2: false,
    dapur: true,
    kamarMandi: false
  },
  cctv: {
    teras: true,
    garasi: true,
    ruangTamu: true,
    belakangRumah: false
  },
  devices: {
    kulkas: { name: 'Kulkas', watt: 120, on: true },
    tv: { name: 'TV', watt: 80, on: false },
    pompa: { name: 'Pompa Air', watt: 250, on: false },
    riceCooker: { name: 'Rice Cooker', watt: 300, on: false },
    ac: { name: 'AC', watt: 700, on: false },
    laptop: { name: 'Laptop', watt: 65, on: true },
    router: { name: 'Router & CCTV', watt: 35, on: true }
  },
  batteryPercent: 74,
  totalData: 0
};

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
  return Math.floor(random(min, max + 1));
}

function getTotalConsumption() {
  const devicePower = Object.values(state.devices)
    .filter((device) => device.on)
    .reduce((total, device) => total + device.watt, 0);

  const lampPower = Object.values(state.lights)
    .filter(Boolean)
    .length * 12;

  return devicePower + lampPower;
}

function getSolarPower() {
  const hour = new Date().getHours();

  if (hour >= 6 && hour <= 17) {
    return randomInt(250, 1100);
  }

  return randomInt(0, 30);
}

function createSnapshot() {
  const totalConsumption = getTotalConsumption();
  const solarPower = getSolarPower();

  const energyBalance = solarPower - totalConsumption;
  state.batteryPercent += energyBalance / 3000;
  state.batteryPercent = Math.max(15, Math.min(100, state.batteryPercent));

  const batteryVoltages = [1, 2, 3, 4].map(() => {
    const voltage = 12.0 + (state.batteryPercent / 100) * 1.8 + random(-0.08, 0.08);
    return Number(voltage.toFixed(2));
  });

  const totalBatteryVoltage = batteryVoltages.reduce((total, voltage) => total + voltage, 0);

  const kitchenTemp = Number(random(27, 37).toFixed(1));
  const gasPpm = randomInt(120, 420);
  const smokeDetected = Math.random() < 0.08;

  const fireStatus = smokeDetected || kitchenTemp > 35 ? 'Waspada' : 'Aman';
  const gasStatus = gasPpm > 350 ? 'Waspada' : 'Aman';
  const inverterStatus = totalConsumption > 1200 ? 'Beban Tinggi' : 'Normal';

  state.totalData += 1;

  return {
    time: new Date().toLocaleTimeString('id-ID'),
    lights: state.lights,
    cctv: state.cctv,
    devices: state.devices,
    sensors: {
      kitchenTemp,
      gasPpm,
      smokeDetected,
      fireStatus,
      gasStatus
    },
    energy: {
      solarPower,
      panelVoltage: Number(random(32, 44).toFixed(1)),
      batteryVoltages,
      totalBatteryVoltage: Number(totalBatteryVoltage.toFixed(2)),
      batteryPercent: Math.round(state.batteryPercent),
      totalConsumption,
      inverterStatus,
      mode: solarPower >= totalConsumption ? 'Charging dari panel surya' : 'Menggunakan daya baterai'
    },
    maintenance: {
      lastCleaning: '20 April 2026',
      nextCleaning: '27 April 2026',
      status: 'Panel perlu dicek secara berkala'
    },
    totalData: state.totalData
  };
}

function broadcast(payload) {
  const message = JSON.stringify(payload);

  server.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

server.on('connection', (socket) => {
  console.log('Dashboard baru terhubung');

  socket.send(JSON.stringify({
    type: 'welcome',
    message: 'Terhubung ke server simulasi Smart Home IoT'
  }));

  socket.send(JSON.stringify({
    type: 'snapshot',
    data: createSnapshot()
  }));

  socket.on('message', (message) => {
    const payload = JSON.parse(message.toString());

    if (payload.type === 'toggle-light') {
      state.lights[payload.key] = !state.lights[payload.key];
      console.log(`Lampu ${payload.key} diubah menjadi ${state.lights[payload.key] ? 'ON' : 'OFF'}`);
    }

    if (payload.type === 'toggle-device') {
      state.devices[payload.key].on = !state.devices[payload.key].on;
      console.log(`Perangkat ${state.devices[payload.key].name} diubah menjadi ${state.devices[payload.key].on ? 'ON' : 'OFF'}`);
    }

    if (payload.type === 'toggle-cctv') {
      state.cctv[payload.key] = !state.cctv[payload.key];
      console.log(`CCTV ${payload.key} diubah menjadi ${state.cctv[payload.key] ? 'Aktif' : 'Offline'}`);
    }

    broadcast({
      type: 'snapshot',
      data: createSnapshot()
    });
  });

  socket.on('close', () => {
    console.log('Dashboard terputus');
  });
});

setInterval(() => {
  broadcast({
    type: 'snapshot',
    data: createSnapshot()
  });
}, 2000);

console.log('Server Smart Home WebSocket berjalan di ws://localhost:8080');