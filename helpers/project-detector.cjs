#!/usr/bin/env node
/**
 * Dev-Standard Project Detector
 * Auto-detects project type, framework, test/build commands.
 * 0 external dependencies.
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();

const PROFILES = [
  {
    signature: 'pom.xml',
    type: 'java-maven',
    test: './mvnw test',
    build: './mvnw clean install',
    sourcePattern: 'src/main/java/**/*.java',
    testPattern: 'src/test/java/**/*Test.java',
    detectFramework: (root) => {
      try {
        const pom = fs.readFileSync(path.join(root, 'pom.xml'), 'utf-8');
        if (pom.includes('spring-boot')) return 'spring-boot';
        if (pom.includes('quarkus')) return 'quarkus';
        if (pom.includes('micronaut')) return 'micronaut';
      } catch { /* ignore */ }
      return null;
    },
  },
  {
    signature: 'build.gradle',
    altSignature: 'build.gradle.kts',
    type: 'java-gradle',
    test: './gradlew test',
    build: './gradlew build',
    sourcePattern: 'src/main/java/**/*.java',
    testPattern: 'src/test/java/**/*Test.java',
    detectFramework: (root) => {
      try {
        const gradle = fs.readFileSync(path.join(root, 'build.gradle'), 'utf-8');
        if (gradle.includes('spring-boot')) return 'spring-boot';
      } catch { /* ignore */ }
      return null;
    },
  },
  {
    signature: 'package.json',
    type: 'node',
    test: 'npm test',
    build: 'npm run build',
    sourcePattern: 'src/**/*.{ts,js,tsx,jsx}',
    testPattern: 'src/**/*.{test,spec}.{ts,js,tsx,jsx}',
    detectFramework: (root) => {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps['vue'] || deps['nuxt']) return deps['nuxt'] ? 'nuxt' : 'vue';
        if (deps['react'] || deps['next']) return deps['next'] ? 'next' : 'react';
        if (deps['@angular/core']) return 'angular';
        if (deps['svelte'] || deps['@sveltejs/kit']) return 'svelte';
        if (deps['express']) return 'express';
        if (deps['@nestjs/core']) return 'nestjs';
        if (deps['fastify']) return 'fastify';
      } catch { /* ignore */ }
      return null;
    },
  },
  {
    signature: 'go.mod',
    type: 'go',
    test: 'go test ./...',
    build: 'go build ./...',
    sourcePattern: '**/*.go',
    testPattern: '**/*_test.go',
    detectFramework: (root) => {
      try {
        const gomod = fs.readFileSync(path.join(root, 'go.mod'), 'utf-8');
        if (gomod.includes('gin-gonic')) return 'gin';
        if (gomod.includes('gorilla/mux')) return 'gorilla';
        if (gomod.includes('echo')) return 'echo';
        if (gomod.includes('fiber')) return 'fiber';
      } catch { /* ignore */ }
      return null;
    },
  },
  {
    signature: 'pyproject.toml',
    altSignature: 'setup.py',
    type: 'python',
    test: 'pytest',
    build: '',
    sourcePattern: '**/*.py',
    testPattern: 'tests/test_*.py',
    detectFramework: (root) => {
      try {
        const toml = fs.readFileSync(path.join(root, 'pyproject.toml'), 'utf-8');
        if (toml.includes('django')) return 'django';
        if (toml.includes('fastapi')) return 'fastapi';
        if (toml.includes('flask')) return 'flask';
      } catch { /* ignore */ }
      try {
        if (fs.existsSync(path.join(root, 'manage.py'))) return 'django';
      } catch { /* ignore */ }
      return null;
    },
  },
  {
    signature: 'Cargo.toml',
    type: 'rust',
    test: 'cargo test',
    build: 'cargo build',
    sourcePattern: 'src/**/*.rs',
    testPattern: 'tests/**/*.rs',
    detectFramework: (root) => {
      try {
        const cargo = fs.readFileSync(path.join(root, 'Cargo.toml'), 'utf-8');
        if (cargo.includes('actix')) return 'actix';
        if (cargo.includes('axum')) return 'axum';
        if (cargo.includes('rocket')) return 'rocket';
      } catch { /* ignore */ }
      return null;
    },
  },
  {
    signature: '*.csproj',
    altSignature: '*.sln',
    type: 'dotnet',
    test: 'dotnet test',
    build: 'dotnet build',
    sourcePattern: '**/*.cs',
    testPattern: '**/*Tests.cs',
    detectFramework: () => null,
    checkGlob: true,
  },
  {
    signature: 'Gemfile',
    type: 'ruby',
    test: 'bundle exec rspec',
    build: '',
    sourcePattern: '**/*.rb',
    testPattern: 'spec/**/*_spec.rb',
    detectFramework: (root) => {
      try {
        const gemfile = fs.readFileSync(path.join(root, 'Gemfile'), 'utf-8');
        if (gemfile.includes('rails')) return 'rails';
        if (gemfile.includes('sinatra')) return 'sinatra';
      } catch { /* ignore */ }
      return null;
    },
  },
  {
    signature: 'pubspec.yaml',
    type: 'dart',
    test: 'flutter test',
    build: 'flutter build',
    sourcePattern: 'lib/**/*.dart',
    testPattern: 'test/**/*_test.dart',
    detectFramework: () => 'flutter',
  },
];

function detect(root) {
  const projectRoot = root || PROJECT_ROOT;

  for (const profile of PROFILES) {
    let found = false;

    if (profile.checkGlob) {
      // Glob-style check (*.csproj, *.sln)
      try {
        const files = fs.readdirSync(projectRoot);
        const pattern = profile.signature.replace('*', '');
        found = files.some(f => f.endsWith(pattern));
        if (!found && profile.altSignature) {
          const altPattern = profile.altSignature.replace('*', '');
          found = files.some(f => f.endsWith(altPattern));
        }
      } catch { /* ignore */ }
    } else {
      found = fs.existsSync(path.join(projectRoot, profile.signature));
      if (!found && profile.altSignature) {
        found = fs.existsSync(path.join(projectRoot, profile.altSignature));
      }
    }

    if (found) {
      const framework = profile.detectFramework ? profile.detectFramework(projectRoot) : null;
      return {
        projectType: profile.type,
        framework,
        testCommand: profile.test,
        buildCommand: profile.build,
        sourcePattern: profile.sourcePattern,
        testPattern: profile.testPattern,
      };
    }
  }

  return {
    projectType: 'unknown',
    framework: null,
    testCommand: '',
    buildCommand: '',
    sourcePattern: '**/*',
    testPattern: '',
  };
}

// CLI
if (require.main === module) {
  const [,, cmd] = process.argv;
  if (cmd === '--init') {
    // Write detection result to dev-standard.json
    const result = detect();
    const configPath = path.join(PROJECT_ROOT, '.claude', 'dev-standard.json');
    const config = {
      version: '1.0.0',
      projectType: result.projectType,
      framework: result.framework,
      gates: {
        specification: 'warn',
        pseudocode: 'warn',
        architecture: 'warn',
        refinement: 'warn',
        completion: 'block',
      },
      testCommand: result.testCommand,
      buildCommand: result.buildCommand,
      sourcePattern: result.sourcePattern,
      testPattern: result.testPattern,
    };
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`Detected: ${result.projectType}${result.framework ? ' (' + result.framework + ')' : ''}`);
    console.log(`Config written to: ${configPath}`);
  } else {
    const result = detect();
    console.log(JSON.stringify(result, null, 2));
  }
}

module.exports = { detect };
