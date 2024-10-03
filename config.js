module.exports = {
    token: '',  // Your Discord bot token
    channelId: '',  // Channel for both resource and site monitor updates
    refreshInterval: 10 * 1000,  // 30 seconds refresh interval
    webMonitor: true,
    sitesToMonitor: [
        { 
            url: 'https://youtube.com', 
            name: 'YouTube' 
        },
        {
            url: 'https://google.com',
            name: 'Google',
            headers: { 'Authorization': 'blahblah' }  // Example of custom headers
        },
        { 
            ping: '1.1.1.1', 
            name: 'IP' 
        }, 
        // Add more sites or IPs as needed
      ],
  };
  