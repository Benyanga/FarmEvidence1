const dns = require('dns');
const mongoose = require('mongoose');

// The local DNS resolver Node picks up on this machine (127.0.0.1) refuses
// connections, breaking the SRV/A lookups Atlas connection strings rely on.
// Point Node at a working public resolver before connecting.
if (dns.getServers().every((server) => server === '127.0.0.1')) {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

async function connectDB() {
  mongoose.set('strictQuery', true);
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }
  await mongoose.connect(uri);
  console.log(`[db] connected to MongoDB (${mongoose.connection.name})`);
  return mongoose.connection;
}

module.exports = { connectDB };
