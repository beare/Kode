#!/usr/bin/env node
import { build } from 'esbuild'
import { existsSync, mkdirSync, writeFileSync, cpSync, readFileSync, readdirSync, statSync, chmodSync } from 'node:fs'
import { join, resolve, dirname, relative } from 'node:path'

const SRC_DIR = 'src'
const OUT_DIR = 'dist'

function collectEntries(dir, acc = []) {
  const items = readdirSync(dir)
  for (const name of items) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) {
      // skip tests and storybook or similar folders if any, adjust as needed
      if (name === 'test' || name === '__tests__') continue
      collectEntries(p, acc)
    } else if (st.isFile()) {
      if (p.endsWith('.ts') || p.endsWith('.tsx')) acc.push(p)
    }
  }
  return acc
}

function fixRelativeImports(dir) {
  const items = readdirSync(dir)
  for (const name of items) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) {
      fixRelativeImports(p)
      continue
    }
    if (!p.endsWith('.js')) continue
    let text = readFileSync(p, 'utf8')

    // First, replace @ aliases with relative paths
    text = replaceAliases(p, text)

    // Then handle: from '...'
    text = text.replace(/(from\s+['"])(\.{1,2}\/[^'"\n]+)(['"])/gm, (m, a, spec, c) => {
      if (/\.(js|json|node|mjs|cjs)$/.test(spec)) return m
      return a + spec + '.js' + c
    })
    // Handle: export ... from '...'
    text = text.replace(/(export\s+[^;]*?from\s+['"])(\.{1,2}\/[^'"\n]+)(['"])/gm, (m, a, spec, c) => {
      if (/\.(js|json|node|mjs|cjs)$/.test(spec)) return m
      return a + spec + '.js' + c
    })
    // Handle: dynamic import('...')
    text = text.replace(/(import\(\s*['"])(\.{1,2}\/[^'"\n]+)(['"]\s*\))/gm, (m, a, spec, c) => {
      if (/\.(js|json|node|mjs|cjs)$/.test(spec)) return m
      return a + spec + '.js' + c
    })
    writeFileSync(p, text)
  }
}

function replaceAliases(filePath, content) {
  // Define aliases based on tsconfig.json paths
  // Each alias can have:
  // - exact: for exact matches like '@commands'
  // - wildcard: for path matches like '@commands/*'
  const aliasConfig = {
    '@components': { exact: 'components', wildcard: 'components' },
    '@commands': { exact: 'commands.ts', wildcard: 'commands' },
    '@utils': { exact: 'utils', wildcard: 'utils' },
    '@constants': { exact: 'constants', wildcard: 'constants' },
    '@hooks': { exact: 'hooks', wildcard: 'hooks' },
    '@services': { exact: 'services', wildcard: 'services' },
    '@screens': { exact: 'screens', wildcard: 'screens' },
    '@tools': { exact: 'tools.ts', wildcard: 'tools' },
    '@tool': { exact: 'Tool.ts' },
    '@kode-types': { exact: 'types', wildcard: 'types' },
    '@context': { exact: 'context.ts', wildcard: 'context' },
    '@history': { exact: 'history.ts' },
    '@costTracker': { exact: 'cost-tracker.ts' },
    '@permissions': { exact: 'permissions.ts' },
    '@query': { exact: 'query.ts' },
    '@messages': { exact: 'messages.ts' },
  }

  const fileDir = dirname(filePath)
  const distRoot = resolve(OUT_DIR)

  // Helper function to resolve and make relative
  const makeRelativePath = (targetPath) => {
    const targetAbsolute = resolve(distRoot, targetPath)
    let relPath = relative(fileDir, targetAbsolute)
    if (!relPath.startsWith('.')) relPath = './' + relPath
    // Remove .ts/.tsx extensions from the path
    relPath = relPath.replace(/\.(ts|tsx)$/, '')
    return relPath
  }

  for (const [alias, config] of Object.entries(aliasConfig)) {
    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // 1. Handle exact matches: from '@commands' (no slash)
    if (config.exact) {
      const exactPattern = new RegExp(`(from\\s+['"])${escapedAlias}(['"])`, 'g')
      content = content.replace(exactPattern, (_, prefix, suffix) => {
        return `${prefix}${makeRelativePath(config.exact)}${suffix}`
      })

      const exportExactPattern = new RegExp(`(export\\s+[^;]*?from\\s+['"])${escapedAlias}(['"])`, 'g')
      content = content.replace(exportExactPattern, (_, prefix, suffix) => {
        return `${prefix}${makeRelativePath(config.exact)}${suffix}`
      })
    }

    // 2. Handle wildcard matches: from '@commands/foo' (with slash)
    if (config.wildcard) {
      const wildcardPattern = new RegExp(`(from\\s+['"])${escapedAlias}/([^'"]+)(['"])`, 'g')
      content = content.replace(wildcardPattern, (_, prefix, subPath, suffix) => {
        const targetPath = join(config.wildcard, subPath)
        return `${prefix}${makeRelativePath(targetPath)}${suffix}`
      })

      const exportWildcardPattern = new RegExp(`(export\\s+[^;]*?from\\s+['"])${escapedAlias}/([^'"]+)(['"])`, 'g')
      content = content.replace(exportWildcardPattern, (_, prefix, subPath, suffix) => {
        const targetPath = join(config.wildcard, subPath)
        return `${prefix}${makeRelativePath(targetPath)}${suffix}`
      })
    }
  }

  return content
}

async function main() {
  console.log('🚀 Building Kode CLI for cross-platform compatibility...')
  
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

  const entries = collectEntries(SRC_DIR)

  // Build ESM format but ensure Node.js compatibility
  await build({
    entryPoints: entries,
    outdir: OUT_DIR,
    outbase: SRC_DIR,
    bundle: false,
    platform: 'node',
    format: 'esm',
    target: ['node20'],
    sourcemap: true,
    legalComments: 'none',
    logLevel: 'info',
    tsconfig: 'tsconfig.json',
  })

  // Fix relative import specifiers to include .js extension for ESM
  fixRelativeImports(OUT_DIR)

  // Mark dist as ES module
  writeFileSync(join(OUT_DIR, 'package.json'), JSON.stringify({
    type: 'module',
    main: './entrypoints/cli.js'
  }, null, 2))

  // Create a proper entrypoint - ESM with async handling
  const mainEntrypoint = join(OUT_DIR, 'index.js')
  writeFileSync(mainEntrypoint, `#!/usr/bin/env node
import('./entrypoints/cli.js').catch(err => {
  console.error('❌ Failed to load CLI:', err.message);
  process.exit(1);
});
`)

  // Copy yoga.wasm alongside outputs
  try {
    cpSync('yoga.wasm', join(OUT_DIR, 'yoga.wasm'))
    console.log('✅ yoga.wasm copied to dist')
  } catch (err) {
    console.warn('⚠️  Could not copy yoga.wasm:', err.message)
  }

  // Create cross-platform CLI wrapper
  const cliWrapper = `#!/usr/bin/env node

// Cross-platform CLI wrapper for Kode
// Prefers Bun but falls back to Node.js with tsx loader

const { spawn } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');

// Get the directory where this CLI script is installed
const kodeDir = __dirname;
const distPath = path.join(kodeDir, 'dist', 'index.js');

// Check if we have a built version
if (!existsSync(distPath)) {
  console.error('❌ Built files not found. Run "bun run build" first.');
  process.exit(1);
}

// Try to use Bun first, then fallback to Node.js with tsx
const runWithBun = () => {
  const proc = spawn('bun', ['run', distPath, ...process.argv.slice(2)], {
    stdio: 'inherit',
    cwd: process.cwd()  // Use current working directory, not kode installation directory
  });

  proc.on('error', (err) => {
    if (err.code === 'ENOENT') {
      // Bun not found, try Node.js
      runWithNode();
    } else {
      console.error('❌ Failed to start with Bun:', err.message);
      process.exit(1);
    }
  });

  proc.on('close', (code) => {
    process.exit(code);
  });
};

const runWithNode = () => {
  const proc = spawn('node', [distPath, ...process.argv.slice(2)], {
    stdio: 'inherit',
    cwd: process.cwd()  // Use current working directory, not kode installation directory
  });

  proc.on('error', (err) => {
    console.error('❌ Failed to start with Node.js:', err.message);
    process.exit(1);
  });

  proc.on('close', (code) => {
    process.exit(code);
  });
};

// Start with Bun preference
runWithBun();
`;

  writeFileSync('cli.js', cliWrapper);

  // Make cli.js executable
  try {
    chmodSync('cli.js', 0o755);
    console.log('✅ cli.js made executable');
  } catch (err) {
    console.warn('⚠️  Could not make cli.js executable:', err.message);
  }

  // Create .npmrc file
  const npmrcContent = `# Kode npm configuration
package-lock=false
save-exact=true
`;

  writeFileSync('.npmrc', npmrcContent);

  console.log('✅ Build completed for cross-platform compatibility!')
  console.log('📋 Generated files:')
  console.log('  - dist/ (ESM modules)')
  console.log('  - dist/index.js (main entrypoint)')
  console.log('  - dist/entrypoints/cli.js (CLI main)')
  console.log('  - cli.js (cross-platform wrapper)')
  console.log('  - .npmrc (npm configuration)')
}

main().catch(err => {
  console.error('❌ Build failed:', err)
  process.exit(1)
})
