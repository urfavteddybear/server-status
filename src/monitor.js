const { Client, GatewayIntentBits } = require('discord.js');
const si = require('systeminformation');
const os = require('os');
const { token, resourceChannelId, refreshInterval } = require('../config');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Cache to store infrequently changing data
let staticSystemInfo = null;
let lastSystemCheck = 0;
const STATIC_INFO_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Error handling and retry logic
async function safeApiCall(fn, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  
  const resourceChannel = client.channels.cache.get(resourceChannelId);

  if (!resourceChannel) {
    console.error('Resource channel not found!');
    return;
  }

  let resourceSentMessage;

  function formatSize(size) {
    let value, unit;
    
    if (size > 1024 ** 4) {
        value = size / (1024 ** 4);
        unit = 'TB';
    } else if (size > 1024 ** 3) {
        value = size / (1024 ** 3);
        unit = 'GB';
    } else if (size > 1024 ** 2) {
        value = size / (1024 ** 2);
        unit = 'MB';
    } else {
        value = size / 1024;
        unit = 'KB';
    }

    const hundredths = Math.round((value - Math.floor(value)) * 100);

    if (hundredths >= 50) {
        value = Math.ceil(value);
    } else if (hundredths <= 40) {
        value = Math.floor(value);
    } else {
        value = value.toFixed(2);
    }

    return `${value} ${unit}`;
  }

  function createProgressBar(percentage, length = 10) {
    const filled = Math.round(percentage / 100 * length);
    const empty = length - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `${bar} ${percentage.toFixed(1)}%`;
  }

  function getColorByPercentage(percentage) {
    if (percentage < 50) return 0x00ff00; // Green
    if (percentage < 70) return 0xffff00; // Yellow
    if (percentage < 85) return 0xff8800; // Orange
    return 0xff0000; // Red
  }

  function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  // Function to get static system info (rarely changes)
  async function getStaticSystemInfo() {
    const now = Date.now();
    if (!staticSystemInfo || (now - lastSystemCheck) > STATIC_INFO_CACHE_DURATION) {
      try {
        staticSystemInfo = await safeApiCall(() => si.cpu());
        lastSystemCheck = now;
      } catch (error) {
        console.error('Error fetching static system info:', error);
        staticSystemInfo = staticSystemInfo || { manufacturer: 'Unknown', brand: 'Unknown', cores: 'N/A', speed: 'N/A' };
      }
    }
    return staticSystemInfo;
  }

  async function fetchSystemData() {
    try {
      // Ambil data statis (cached)
      const cpu = await getStaticSystemInfo();
      
      // Get dynamic data in parallel with error handling
      const [cpuLoad, memory, disk, network, cpuTemperature] = await Promise.allSettled([
        safeApiCall(() => si.currentLoad()),
        safeApiCall(() => si.mem()),
        safeApiCall(() => si.fsSize()),
        safeApiCall(() => si.networkStats()),
        safeApiCall(() => si.cpuTemperature())
      ]);

      // Extract values with fallback and debugging
      const cpuLoadValue = cpuLoad.status === 'fulfilled' ? cpuLoad.value : { currentLoad: 0 };
      const memoryValue = memory.status === 'fulfilled' ? memory.value : { total: 0, used: 0, available: 0, active: 0 };
      const diskValue = disk.status === 'fulfilled' ? disk.value : [{ size: 0, used: 0, available: 0 }];
      const networkValue = network.status === 'fulfilled' ? network.value : [{ tx_sec: 0, rx_sec: 0, iface: 'Unknown' }];
      const cpuTempValue = cpuTemperature.status === 'fulfilled' ? cpuTemperature.value : { main: null };

      const uptime = os.uptime();
      const platform = os.platform();

      // Calculate percentages with safe checks
      const cpuPercentage = Math.max(0, Math.min(100, cpuLoadValue.currentLoad || 0));
      
      // Fix memory calculation - use correct properties
      const memTotal = memoryValue.total || 0;
      const memUsed = memoryValue.used || memoryValue.active || 0;
      const memAvailable = memoryValue.available || memoryValue.free || (memTotal - memUsed);
      const memoryPercentage = memTotal > 0 ? Math.max(0, Math.min(100, (memUsed / memTotal) * 100)) : 0;
      
      // Fix disk calculation
      const diskInfo = diskValue && diskValue.length > 0 ? diskValue[0] : { size: 0, used: 0, available: 0 };
      const diskTotal = diskInfo.size || 0;
      const diskUsed = diskInfo.used || 0;
      const diskAvailable = diskInfo.available || diskInfo.free || (diskTotal - diskUsed);
      const diskPercentage = diskTotal > 0 ? Math.max(0, Math.min(100, (diskUsed / diskTotal) * 100)) : 0;

    // Determine embed color based on highest resource usage
    const maxUsage = Math.max(cpuPercentage, memoryPercentage, diskPercentage);
    const embedColor = getColorByPercentage(maxUsage);

    // Format CPU temperature - only show if available
    const tempDisplay = cpuTempValue.main ? `\n**Temperature:** ${Math.round(cpuTempValue.main)}°C` : '';

    const resourceEmbed = {
      color: embedColor,
      title: ' **📊 Server Resource Monitor**',
      // description: `📊 **System Status Overview** • 🕐 Last Updated: <t:${Math.floor(Date.now() / 1000)}:R>`,
      fields: [
        {
          name: '📈 **CPU Information**',
          value: `**Processor:** ${cpu.manufacturer} ${cpu.brand}\n**Cores:** ${cpu.cores} cores @ ${cpu.speed}GHz\n**Usage:** ${createProgressBar(cpuPercentage)}${tempDisplay}`,
          inline: false
        },
        {
          name: '💾 **Memory Usage**',
          value: `**Total:** ${formatSize(memTotal)}\n**Used:** ${formatSize(memUsed)} \n**Available:** ${formatSize(memAvailable)}\n**Usage:** ${createProgressBar(memoryPercentage)}`,
          inline: true
        },
        {
          name: '💽 **Storage Usage**',
          value: `**Total:** ${formatSize(diskTotal)}\n**Used:** ${formatSize(diskUsed)}\n**Free:** ${formatSize(diskAvailable)}\n**Usage:** ${createProgressBar(diskPercentage)}`,
          inline: true
        },
        {
          name: '🌐 **Network Activity**',
          value: `**⬆️ Upload:** ${formatSize(networkValue[0]?.tx_sec || 0)}/s\n**⬇️ Download:** ${formatSize(networkValue[0]?.rx_sec || 0)}/s\n**Interface:** ${networkValue[0]?.iface || 'Unknown'}`,
          inline: true
        },
        {
          name: '⏰ **System Uptime**',
          value: `**Duration:** ${formatUptime(uptime)}\n**Platform:** ${platform.charAt(0).toUpperCase() + platform.slice(1)}\n**Hostname:** ${os.hostname()}`,
          inline: true
        }
      ],
      footer: {
        text: `Server Monitor • Updated every ${refreshInterval / 1000}s`,
      },
      timestamp: new Date(),
    };

    // Send resource monitor to the resource channel
    if (resourceSentMessage) {
      await resourceSentMessage.edit({ embeds: [resourceEmbed] }).catch(console.error);
    } else {
      resourceSentMessage = await resourceChannel.send({ embeds: [resourceEmbed] }).catch(console.error);
    }

    // Delete old messages
    const messages = await resourceChannel.messages.fetch({ limit: 10 });
    messages.forEach(async (message) => {
      if (message.author.id === client.user.id && message.id !== resourceSentMessage.id) {
        await message.delete().catch(console.error);
      }
    });

    } catch (error) {
      console.error('Error in fetchSystemData:', error);
      // Fallback for error handling - send simple error message
      const errorEmbed = {
        color: 0xff0000,
        title: '❌ **System Monitor Error**',
        description: 'Failed to fetch system data. Retrying in next interval...',
        timestamp: new Date(),
      };
      
      if (resourceSentMessage) {
        await resourceSentMessage.edit({ embeds: [errorEmbed] }).catch(console.error);
      } else {
        resourceSentMessage = await resourceChannel.send({ embeds: [errorEmbed] }).catch(console.error);
      }
    }
  }

  fetchSystemData();
  setInterval(fetchSystemData, refreshInterval);
});

client.login(token);
