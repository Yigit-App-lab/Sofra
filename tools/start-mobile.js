const os = require('os');
const { spawn } = require('child_process');

const mode = process.argv[2] || 'tunnel';
const clear = process.argv.includes('--clear');
if (!['tunnel', 'lan'].includes(mode)) {
  console.error('Usage: node tools/start-mobile.js tunnel|lan [--clear]');
  process.exit(1);
}

const env = { ...process.env };
const args = [require.resolve('expo/bin/cli'), 'start', '--dev-client', `--${mode}`];
if (clear) args.push('--clear');

if (mode === 'lan') {
  const addresses = Object.values(os.networkInterfaces()).flat().filter((entry) =>
    entry && entry.family === 'IPv4' && !entry.internal && !entry.address.startsWith('169.254.')
  );
  if (!addresses.length) {
    console.error('No LAN IPv4 address found. Use: npm run ios:dev');
    process.exit(1);
  }
  env.REACT_NATIVE_PACKAGER_HOSTNAME = addresses[0].address;
  console.log(`Starting Metro on LAN address ${addresses[0].address}`);
} else {
  delete env.REACT_NATIVE_PACKAGER_HOSTNAME;
  console.log('Starting Metro through a tunnel. Keep this terminal open.');
}

const child = spawn(process.execPath, args, { cwd: process.cwd(), env, stdio: 'inherit' });
child.on('exit', (code, signal) => process.exitCode = code ?? (signal ? 1 : 0));

