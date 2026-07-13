const { createClerkClient } = require('@clerk/backend');

if (!process.env.CLERK_SECRET_KEY) {
  console.warn('[clerk] CLERK_SECRET_KEY is not set — auth will fail');
}

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

module.exports = { clerkClient };
