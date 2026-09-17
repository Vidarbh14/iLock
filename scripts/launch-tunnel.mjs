import localtunnel from 'localtunnel';

async function startTunnel() {
  console.log('Starting public HTTPS tunnel to localhost:3000...');
  try {
    const tunnel = await localtunnel({ port: 3000 });
    console.log('================================================================');
    console.log('PUBLIC_URL: ' + tunnel.url);
    console.log('================================================================');

    tunnel.on('close', () => {
      console.log('Tunnel closed.');
    });

    tunnel.on('error', (err) => {
      console.error('Tunnel error:', err);
    });
  } catch (err) {
    console.error('Failed to establish tunnel:', err);
  }
}

startTunnel();
