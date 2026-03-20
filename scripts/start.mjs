#!/usr/bin/env node
console.log('🚀 Starting P2P SaaS...');
const { default: server } = await import('../dist/index.js');
