const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'dev.db');
console.log('DB Path:', dbPath);

const db = new Database(dbPath);

console.log('Seeding base topics only...');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
if (tables.length <= 1) {
    console.log('Tables not found. Run: npx prisma db push');
    process.exit(1);
}

const insertTopic = db.prepare(`
    INSERT OR IGNORE INTO Topic (id, name, description, orderIndex, category)
    VALUES (?, ?, ?, ?, ?)
`);

const topicData = [
    [1, 'Aritmetica Basica', 'Operaciones fundamentales', 1, 'Fundamentos'],
    [2, 'Fracciones', 'Operaciones con fracciones', 2, 'Fundamentos'],
    [3, 'Algebra Basica', 'Ecuaciones lineales y expresiones', 3, 'Algebra'],
    [4, 'Geometria', 'Areas, perimetros y angulos', 4, 'Geometria'],
    [5, 'Potencias y Raices', 'Exponentes y raices', 5, 'Algebra'],
    [6, 'Ecuaciones Cuadraticas', 'Ecuaciones de segundo grado', 6, 'Algebra'],
    [7, 'Funciones', 'Funciones lineales y cuadraticas', 7, 'Analisis'],
    [8, 'Trigonometria', 'Funciones trigonometricas', 8, 'Trigonometria'],
];

const insertTopics = db.transaction(() => {
    for (const topic of topicData) {
        insertTopic.run(...topic);
    }
});

insertTopics();

const topicCount = db.prepare('SELECT COUNT(*) as c FROM Topic').get();
console.log(`Topics available: ${topicCount.c}`);
console.log('No legacy questions were seeded. Pruebas de Estado now uses JSON files directly.');

db.close();
