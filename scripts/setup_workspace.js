const fs = require('fs');
const path = require('path');

// 1. Create professional directory structure
const dirs = [
    'public',
    'src/js',
    'src/css',
    'src/assets/images',
    'src/assets/fonts',
    'src/assets/icons',
    'src/components',
    'src/services',
    'src/utils',
    '.github/workflows'
];

console.log('🏗️ Scaffolding professional directory structure...');
for (const d of dirs) {
    if (!fs.existsSync(d)) {
        fs.mkdirSync(d, { recursive: true });
        console.log(`   ✔️ Created /${d}`);
    }
}

// 2. Move existing flat files into proper context
console.log('\n📦 Migrating source files...');
const moves = [
    { from: 'app.js', to: 'src/js/app.js' },
    { from: 'styles.css', to: 'src/css/styles.css' },
    { from: 'sample_telecom_data.csv', to: 'public/sample_telecom_data.csv' }
];

moves.forEach(m => {
    if (fs.existsSync(m.from)) {
        fs.renameSync(m.from, m.to);
        console.log(`   ✔️ Moved ${m.from} ➔ ${m.to}`);
    }
});

// 3. Update index.html for Vite module resolution
if (fs.existsSync('index.html')) {
    console.log('\n🔗 Updating index.html references for Vite builder...');
    let indexHtml = fs.readFileSync('index.html', 'utf8');
    indexHtml = indexHtml.replace('href="styles.css"', 'href="/src/css/styles.css"');
    indexHtml = indexHtml.replace('src="app.js"', 'type="module" src="/src/js/app.js"');
    fs.writeFileSync('index.html', indexHtml);
    console.log('   ✔️ Updated <script> and <link> standard paths.');
}

console.log('\n✨ Professional Workspace Restructuring Complete!');
console.log('You can safely delete this script (setup_workspace.js) now.');
