#!/usr/bin/env node
import { execSync } from 'child_process';

console.log('🚀 Starting P2P SaaS...');

// Run migrations via drizzle push
console.log("⏭️  Skipping migrations - already applied");

// Run seed
try {
  console.log('🌱 Running seed...');
  execSync('node scripts/seed.mjs', { 
    stdio: 'inherit',
    env: { ...process.env }
  });
  console.log('✅ Seed complete');
} catch (e) {
  console.warn('⚠️  Seed warning:', e.message);
}

// Start server
console.log('🌐 Starting server...');
const { default: server } = await import('../dist/index.js');
