#!/usr/bin/env node
import { build } from 'esbuild'
import { existsSync, mkdirSync, writeFileSync, cpSync, readFileSync, readdirSync, statSync, chmodSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'

const SRC_DIR = 'src'
const OUT_DIR = 'dist'

// TypeScript path aliases mapping (from tsconfig.json)
const PATH_ALIASES = {
  '@components': 'src/components',
  '@components/*': 'src/components/*',
  '@commands': 'src/commands.ts',
  '@commands/*': 'src/commands/*',
  '@utils': 'src/utils',
  '@utils/*': 'src/utils/*',
  '@constants': 'src/constants',
  '@constants/*': 'src/constants/*',
  '@hooks': 'src/hooks',
  '@hooks/*': 'src/hooks/*',
  '@services': 'src/services',
  '@services/*': 'src/services/*',
  '@screens': 'src/screens',
  '@screens/*': 'src/screens/*',
  '@tools': 'src/tools.ts',
  '@tools/*': 'src/tools/*',
  '@tool': 'src/Tool.ts',
  '@kode-types': 'src/types',
  '@kode-types/*': 'src/types/*',
  '@context': 'src/context.ts',
  '@context/*': 'src/context/*',
  '@history': 'src/history.ts',
  '@costTracker': 'src/cost-tracker.ts',
  '@permissions': 'src/permissions.ts',
  '@query': 'src/query.ts',
  '@messages': 'src/messages.ts',
}

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

/**
 * Resolve a TypeScript path alias to a relative path
 * @param {string} aliasImport - The import path (e.g., '@services/sentry')
 * @param {string} currentFile - The current file path in dist (e.g., 'dist/entrypoints/cli.js')
 * @returns {string|null} - The resolved relative path or null if not an alias
 */
function resolveAlias(aliasImport, currentFile) {
  // Try exact match first
  if (PATH_ALIASES[aliasImport]) {
    const targetPath = PATH_ALIASES[aliasImport]
    return calculateRelativePath(currentFile, targetPath)
  }

  // Try wildcard match
  for (const [alias, target] of Object.entries(PATH_ALIASES)) {
    if (!alias.endsWith('/*')) continue

    const aliasPrefix = alias.slice(0, -2) // Remove '/*'
    if (aliasImport.startsWith(aliasPrefix + '/')) {
      const suffix = aliasImport.slice(aliasPrefix.length + 1)
      const targetPrefix = target.slice(0, -2) // Remove '/*'
      const targetPath = targetPrefix + '/' + suffix
      return calculateRelativePath(currentFile, targetPath)
    }
  }

  return null
}

/**
 * Calculate relative path from current file to target
 * @param {string} currentFile - Current file path (e.g., 'dist/entrypoints/cli.js')
 * @param {string} targetPath - Target path (e.g., 'src/services/sentry')
 * @returns {string} - Relative path (e.g., '../services/sentry')
 */
function calculateRelativePath(currentFile, targetPath) {
  // Convert src path to dist path
  let distTargetPath = targetPath.replace(/^src\//, 'dist/')

  // Remove .ts/.tsx extension if present
  const hasExtension = /\.(ts|tsx)$/.test(distTargetPath)
  if (hasExtension) {
    distTargetPath = distTargetPath.replace(/\.(ts|tsx)$/, '.js')
  }

  // Get directory of current file
  const currentDir = dirname(currentFile)

  // Calculate relative path
  let relativePath = relative(currentDir, distTargetPath)

  // Ensure it starts with ./ or ../
  if (!relativePath.startsWith('.') && !relativePath.startsWith('..')) {
    relativePath = './' + relativePath
  }

  return relativePath
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

    // Handle path aliases first (before handling relative imports)
    // Match: from '@alias/path' or from '@alias'
    text = text.replace(/(from\s+['"])(@[^'"\n]+)(['"])/gm, (m, a, spec, c) => {
      const resolved = resolveAlias(spec, p)
      if (resolved) {
        // Add .js extension if not pointing to .js, .json, etc.
        const finalPath = /\.(js|json|node|mjs|cjs)$/.test(resolved) ? resolved : resolved + '.js'
        return a + finalPath + c
      }
      return m
    })

    // Handle: export ... from '@alias/path'
    text = text.replace(/(export\s+[^;]*?from\s+['"])(@[^'"\n]+)(['"])/gm, (m, a, spec, c) => {
      const resolved = resolveAlias(spec, p)
      if (resolved) {
        const finalPath = /\.(js|json|node|mjs|cjs)$/.test(resolved) ? resolved : resolved + '.js'
        return a + finalPath + c
      }
      return m
    })

    // Handle: dynamic import('@alias/path')
    text = text.replace(/(import\(\s*['"])(@[^'"\n]+)(['"]\s*\))/gm, (m, a, spec, c) => {
      const resolved = resolveAlias(spec, p)
      if (resolved) {
        const finalPath = /\.(js|json|node|mjs|cjs)$/.test(resolved) ? resolved : resolved + '.js'
        return a + finalPath + c
      }
      return m
    })

    // Handle relative imports: from '...'
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
runWithNode();
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
