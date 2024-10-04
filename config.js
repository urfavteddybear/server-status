module.exports = {
    token: '',  // Your Discord bot token
    resourceChannelId: '',  // Channel for resource monitor updates
    siteChannelId: '',  // Channel for site monitor updates (can be same as resourceChannelId)
    refreshInterval: 10 * 1000,  // 30 seconds refresh interval
    webMonitor: true, // change this to false if you dont want the webmonitor
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
  