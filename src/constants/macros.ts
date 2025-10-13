import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const pkg = require('../../package.json')

export const MACRO = {
  VERSION: pkg.version,
  README_URL: 'https://github.com/beare/znbai#readme',
  PACKAGE_URL: '@beare/znbai',
  ISSUES_EXPLAINER: 'report the issue at https://github.com/beare/znbai/issues',
}
