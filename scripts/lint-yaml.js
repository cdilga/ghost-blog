#!/usr/bin/env node
/**
 * Validate YAML files in .github/workflows/
 * Catches syntax errors before CI runs
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { glob } = require('glob');

async function lintYaml() {
  const workflowsDir = path.join(process.cwd(), '.github', 'workflows');

  if (!fs.existsSync(workflowsDir)) {
    console.log('No .github/workflows directory found');
    return 0;
  }

  const files = await glob('**/*.{yml,yaml}', { cwd: workflowsDir });

  if (files.length === 0) {
    console.log('No YAML files found in .github/workflows/');
    return 0;
  }

  let errors = 0;

  for (const file of files) {
    const filePath = path.join(workflowsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    try {
      yaml.load(content);
      console.log(`✓ ${file}`);
    } catch (err) {
      errors++;
      console.error(`✗ ${file}`);
      console.error(`  Error at line ${err.mark?.line || '?'}: ${err.reason || err.message}`);
    }
  }

  console.log(`\n${files.length} file(s) checked, ${errors} error(s)`);
  return errors;
}

lintYaml()
  .then(errors => process.exit(errors > 0 ? 1 : 0))
  .catch(err => {
    console.error('Failed to lint YAML:', err);
    process.exit(1);
  });
