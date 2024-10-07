const { Client, GatewayIntentBits } = require('discord.js');
const si = require('systeminformation');
const os = require('os');
const axios = require('axios');
const ping = require('ping');
const { token, resourceChannelId, siteChannelId, refreshInterval, sitesToMonitor, webMonitor } = require('../config');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  
  const resourceChannel = client.channels.cache.get(resourceChannelId);
  const siteChannel = client.channels.cache.get(siteChannelId);

  if (!resourceChannel || !siteChannel) {
    console.error('One or both channels not found!');
    return;
  }

  let resourceSentMessage;
  let siteSentMessage;

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

  async function fetchSystemData() {
    const [cpuLoad, memory, disk, network, cpu, cpuTemperature] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkStats(),
      si.cpu(),
      si.cpuTemperature()
  ]);

  const uptime = os.uptime();
  const platform = os.platform();

const uptimeDays = Math.floor(uptime / 86400); // Calculate total days
  const uptimeHours = Math.floor((uptime % 86400) / 3600); // Remaining hours
  const uptimeMinutes = Math.floor((uptime % 3600) / 60); // Remaining minutes
  const uptimeSeconds = Math.floor(uptime % 60); // Remaining seconds

  const uptimeString = `${uptimeDays} Days, ${uptimeHours} Hours, ${uptimeMinutes} Minutes, ${uptimeSeconds} Seconds`;
  const resourceEmbed = {
      color: 0x2F3136,
      title: '📊 **Server Information**',
      fields: [
          {
              name: '💻 **CPU**',
              value: `**Model**: ${cpu.manufacturer} ${cpu.brand}\n**Load**: \`${cpuLoad.currentLoad.toFixed(2)}%\` \n **Temp**: Min \`${cpuTemperature.main}\` Max: \`${cpuTemperature.max}\``,
              inline: true
          },
          {
              name: '🧠 **Memory**',
              value: `**Available**: \`${formatSize(memory.available)}\`\n**Used**: \`${formatSize(memory.active)}\``,
              inline: true
          },
          {
              name: '💽 **Disk**',
              value: `**Used**: \`${formatSize(disk[0].used)}\` / \`${formatSize(disk[0].size)}\``,
              inline: true
          },
          {
              name: '🌐 **Network**',
              value: `**Upload**: \`${formatSize(network[0].tx_sec)} /s\`\n**Download**: \`${formatSize(network[0].rx_sec)} /s\``,
              inline: true
          },
          {
              name: '⏱️ **Uptime**',
              value: `\`${uptimeString}\``,
              inline: true
          },
          {
              name: '🖥️ **Platform**',
              value: `\`${platform}\``,
              inline: true
          },
      ],
      timestamp: new Date(),
  };

    // Send resource monitor to the resource channel
    if (resourceSentMessage) {
      await resourceSentMessage.edit({ embeds: [resourceEmbed] }).catch(console.error);
    } else {
      resourceSentMessage = await resourceChannel.send({ embeds: [resourceEmbed] }).catch(console.error);
    }

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

      // Determine whether to display fields inline (sideways) or block (downwards)
      if (siteFields.length % 3 === 0) {
        siteFields.forEach((field) => {
          field.inline = true;
        });
      } else {
        siteFields.forEach((field) => {
          field.inline = false;
        });
      }

      const maxFieldsPerEmbed = 25;
      let siteEmbeds = [];
      for (let i = 0; i < siteFields.length; i += maxFieldsPerEmbed) {
        const chunk = siteFields.slice(i, i + maxFieldsPerEmbed);
        siteEmbeds.push({
          color: 0x2F3136,
          title: `🌐 **Website/Server Status (Page ${Math.floor(i / maxFieldsPerEmbed) + 1})**`,
          fields: chunk,
          footer: { text: 'Updated every 30 seconds', icon_url: 'https://cdn-icons-png.flaticon.com/512/4333/4333609.png' },
          timestamp: new Date(),
        });
      }

      // Send site monitor to the site channel
      if (siteSentMessage) {
        await siteSentMessage.edit({ embeds: siteEmbeds }).catch(console.error);
      } else {
        siteSentMessage = await siteChannel.send({ embeds: siteEmbeds }).catch(console.error);
      }
    }

    // Delete old messages only from their respective types
    if (resourceChannelId === siteChannelId) {
      // If both monitors send to the same channel, don't delete each other's messages
      const messages = await resourceChannel.messages.fetch({ limit: 10 });
      messages.forEach(async (message) => {
        if (message.author.id === client.user.id && message.id !== resourceSentMessage.id && message.id !== siteSentMessage?.id) {
          await message.delete().catch(console.error);
        }
      });
    } else {
      // For resource channel
      const resourceMessages = await resourceChannel.messages.fetch({ limit: 10 });
      resourceMessages.forEach(async (message) => {
        if (message.author.id === client.user.id && message.id !== resourceSentMessage.id) {
          await message.delete().catch(console.error);
        }
      });

      // For site channel
      const siteMessages = await siteChannel.messages.fetch({ limit: 10 });
      siteMessages.forEach(async (message) => {
        if (message.author.id === client.user.id && message.id !== siteSentMessage.id) {
          await message.delete().catch(console.error);
        }
      });
    }
  }

  fetchSystemData();
  setInterval(fetchSystemData, refreshInterval);
});

client.login(token);
