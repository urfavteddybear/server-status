require('dotenv').config();

// Validate required environment variables
if (!process.env.DISCORD_TOKEN) {
    console.error('❌ Error: DISCORD_TOKEN is required in .env file');
    console.error('💡 Copy .env.example to .env and fill in your values');
    process.exit(1);
}

if (!process.env.RESOURCE_CHANNEL_ID) {
    console.error('❌ Error: RESOURCE_CHANNEL_ID is required in .env file');
    console.error('💡 Copy .env.example to .env and fill in your values');
    process.exit(1);
}

module.exports = {
    token: process.env.DISCORD_TOKEN,
    resourceChannelId: process.env.RESOURCE_CHANNEL_ID,
    refreshInterval: (process.env.REFRESH_INTERVAL_SECONDS || 30) * 1000,
};