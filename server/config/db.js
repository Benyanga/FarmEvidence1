const mongoose = require('mongoose');

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
