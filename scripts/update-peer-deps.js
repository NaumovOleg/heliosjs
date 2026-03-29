#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const PACKAGES_DIR = path.join(__dirname, '../src');
const packages = fs.readdirSync(PACKAGES_DIR);

const packageDeps = {
  core: [],
  http: ['core'],
  aws: ['core'],
  middlewares: ['core'],
};

function getPackageVersions() {
  const versions = {};
  for (const pkg of packages) {
    const pkgPath = path.join(PACKAGES_DIR, pkg, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      versions[pkg] = pkgJson.version;
    }
  }
  return versions;
}

function updatePeerDeps(packageName, versions) {
  const pkgPath = path.join(PACKAGES_DIR, packageName, 'package.json');
  if (!fs.existsSync(pkgPath)) return;

  const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  let updated = false;

  if (pkgJson.peerDependencies) {
    const deps = packageDeps[packageName] || [];
    for (const dep of deps) {
      const version = versions[dep];
      if (version && pkgJson.peerDependencies[`@heliosjs/${dep}`] !== `^${version}`) {
        pkgJson.peerDependencies[`@heliosjs/${dep}`] = `^${version}`;
        updated = true;
        console.log(`✅ Updated peerDependency @heliosjs/${dep} to ^${version} in ${packageName}`);
      }
    }
  }

  if (updated) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 2));
    console.log(`✅ Saved ${packageName}/package.json`);
  }
}

function main() {
  console.log('🔧 Updating peer dependencies...\n');

  const versions = getPackageVersions();
  console.log('Current versions:', versions);

  for (const pkg of packages) {
    updatePeerDeps(pkg, versions);
  }

  console.log('\n✅ Peer dependencies updated successfully!');
}

main();
