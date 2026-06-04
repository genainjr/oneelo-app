const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Determine if we should run the compiled seed or the ts-node seed
const distSeedPath = path.join(__dirname, '../dist/prisma/seed.js');

if (fs.existsSync(distSeedPath)) {
  console.log('Running compiled seed from:', distSeedPath);
  const result = spawnSync('node', [distSeedPath], { stdio: 'inherit' });
  process.exit(result.status ?? 0);
} else {
  console.log('Running typescript seed using ts-node...');
  const tsNodeSeedPath = path.join(__dirname, 'seed.ts');
  const result = spawnSync('npx', ['ts-node', tsNodeSeedPath], { stdio: 'inherit', shell: true });
  process.exit(result.status ?? 0);
}
