const { Client, GatewayIntentBits } = require('discord.js');
const si = require('systeminformation');
const os = require('os');
const axios = require('axios');
const ping = require('ping');
const { token, channelId, refreshInterval, sitesToMonitor, webMonitor } = require('../config');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  const channel = client.channels.cache.get(channelId);

  if (!channel) {
    console.error('Channel not found!');
    return;
  }

  let sentMessage;

  function formatSize(size) {
    if (size > 1024 ** 4) return `${(size / (1024 ** 4)).toFixed(2)} TB`;
    else if (size > 1024 ** 3) return `${(size / (1024 ** 3)).toFixed(2)} GB`;
    else if (size > 1024 ** 2) return `${(size / (1024 ** 2)).toFixed(2)} MB`;
    return `${(size / 1024).toFixed(2)} KB`;
  }

  async function fetchSystemData() {
    const cpuLoad = await si.currentLoad();
    const memory = await si.mem();
    const disk = await si.fsSize();
    const network = await si.networkStats();
    const uptime = os.uptime();
    const platform = os.platform();
    const cpu = await si.cpu();

    const uptimeDays = Math.floor(uptime / 86400);
    const uptimeHours = Math.floor((uptime % 86400) / 3600);
    const uptimeMinutes = Math.floor((uptime % 3600) / 60);
    const uptimeSeconds = Math.floor(uptime % 60);

    const resourceEmbed = {
      color: 0x2F3136,
      title: '📊 **Server Information**',
      fields: [
        { name: '💻 **CPU**', value: `**Model**: ${cpu.manufacturer} ${cpu.brand}\n**Load**: \`${cpuLoad.currentLoad.toFixed(2)}%\``, inline: false },
        { name: '🧠 **Memory**', value: `**Available**: \`${formatSize(memory.available)}\`\n**Used**: \`${formatSize(memory.active)}\``, inline: false },
        { name: '💽 **Disk**', value: `**Used**: \`${formatSize(disk[0].used)}\` / \`${formatSize(disk[0].size)}\``, inline: false },
        { name: '🌐 **Network**', value: `**Upload**: \`${formatSize(network[0].tx_sec)} /s\`\n**Download**: \`${formatSize(network[0].rx_sec)} /s\``, inline: false },
        { name: '⏱️ **Uptime**', value: `\`${uptimeDays} days, ${uptimeHours} hours, ${uptimeMinutes} minutes, ${uptimeSeconds} seconds\``, inline: false },
        { name: '🖥️ **Platform**', value: `\`${platform}\``, inline: true },
      ],
      footer: { text: 'Updated every 30 seconds' },
      timestamp: new Date(),
    };

    let siteEmbeds = [];
    if (webMonitor) {
      let siteFields = await Promise.all(sitesToMonitor.map(async (site) => {
        try {
          let latency;
          if (site.url) {
            const startTime = Date.now();
            const response = await axios.get(site.url, { headers: site.headers || {} });
            latency = Date.now() - startTime;
            return { name: site.name, value: `🟢 Online (${latency} ms)`, inline: true };
          } else if (site.ping) {
            const res = await ping.promise.probe(site.ping);
            latency = res.time;
            return { name: site.name, value: res.alive ? `🟢 Online (${latency} ms)` : '🔴 Offline', inline: true };
          }
        } catch (error) {
          return { name: site.name, value: '🔴 Offline', inline: true };
        }
      }));

      // Logic to format the sites in rows of 3 if the total number of sites is a multiple of 3
      if (siteFields.length % 3 === 0) {
        siteFields.forEach((field, index) => {
          field.inline = true; // All sites are shown inline (side by side)
        });
      } else {
        siteFields.forEach((field) => {
          field.inline = false; // Display sites downward (in column format)
        });
      }

      // Split into multiple embeds if necessary
      const maxFieldsPerEmbed = 25;
      for (let i = 0; i < siteFields.length; i += maxFieldsPerEmbed) {
        const chunk = siteFields.slice(i, i + maxFieldsPerEmbed);
        siteEmbeds.push({
          color: 0x2F3136,
          title: `🌐 **Website/Server Status (Page ${Math.floor(i / maxFieldsPerEmbed) + 1})**`,
          fields: chunk,
          footer: { text: 'Updated every 30 seconds' },
          timestamp: new Date(),
        });
      }
    }

    if (sentMessage) {
      if (webMonitor) {
        await sentMessage.edit({ embeds: [resourceEmbed, ...siteEmbeds] }).catch(console.error);
      } else {
        await sentMessage.edit({ embeds: [resourceEmbed] }).catch(console.error);
      }
    } else {
      if (webMonitor) {
        sentMessage = await channel.send({ embeds: [resourceEmbed, ...siteEmbeds] }).catch(console.error);
      } else {
        sentMessage = await channel.send({ embeds: [resourceEmbed] }).catch(console.error);
      }
    }

    const messages = await channel.messages.fetch({ limit: 10 });
    messages.forEach(async (message) => {
      if (message.author.id === client.user.id && message.id !== sentMessage.id) {
        await message.delete().catch(console.error);
      }
    });
  }

  fetchSystemData();
  setInterval(fetchSystemData, refreshInterval);
});

client.login(token);
