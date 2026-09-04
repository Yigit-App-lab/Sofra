const fs = require('fs');
const net = require('net');
const path = require('path');

const root = path.resolve(__dirname, '..');
const errors = [];
const warnings = [];
const ok = [];

function check(condition, success, failure) {
  if (condition) ok.push(success);
  else errors.push(failure);
}

function readJson(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
  } catch (error) {
    errors.push(`${name} could not be read: ${error.message}`);
    return {};
  }
}

const pkg = readJson('package.json');
const app = readJson('app.json').expo || {};
const eas = readJson('eas.json');

check(pkg.name === 'sofra-app', 'Repository: sofra-app', 'Run this command from the Sofra repository.');
check(Boolean(pkg.dependencies?.['expo-dev-client']), 'Expo development client installed', 'expo-dev-client is missing.');
check(app.slug === 'sofra-app', 'Expo slug: sofra-app', `Unexpected Expo slug: ${app.slug || 'missing'}`);
check(app.ios?.bundleIdentifier === 'com.yberktas.sofra', 'iOS bundle: com.yberktas.sofra', 'Unexpected iOS bundle identifier.');
check(app.android?.package === 'com.yberktas.sofra', 'Android package: com.yberktas.sofra', 'Unexpected Android package name.');
check(Boolean(eas.build?.development?.developmentClient), 'EAS development profile uses a development client', 'EAS development profile is not a development client.');

for (const name of [
  'AGENTS.md', 'PROJECT_BRIEF.md', 'PROJECT_HISTORY.md', 'TODO.md', 'TESTING.md',
  'GoogleService-Info.plist', 'google-services.json', 'app/_layout.js', 'app/(tabs)/index.js',
]) {
  check(fs.existsSync(path.join(root, name)), `Found ${name}`, `Missing ${name}`);
}

console.log('\nSofra preflight');
for (const item of ok) console.log(`  OK    ${item}`);
for (const item of warnings) console.log(`  WARN  ${item}`);
for (const item of errors) console.log(`  ERROR ${item}`);
console.log(`\nNode ${process.version} | Expo SDK ${pkg.dependencies?.expo || 'unknown'}`);

let settled = false;
function finish(message) {
  if (settled) return;
  settled = true;
  console.log(message);
  process.exitCode = errors.length ? 1 : 0;
}

const socket = net.connect({ host: '127.0.0.1', port: 8081 });
socket.setTimeout(500);
socket.on('connect', () => {
  finish('Metro port 8081: already in use (reuse it or stop it before starting another server).');
  socket.destroy();
});
socket.on('timeout', () => {
  finish('Metro port 8081: available.');
  socket.destroy();
});
socket.on('error', () => finish('Metro port 8081: available.'));
