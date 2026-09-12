/**
 * 🔧 Script para reparar conversaciones corruptas v2
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '..', 'dev.db');
const db = new Database(dbPath);

console.log('═══════════════════════════════════════════');
console.log('  🔧 Reparación del sistema de mensajería');
console.log('═══════════════════════════════════════════\n');

const admin = db.prepare("SELECT * FROM User WHERE role = 'admin' LIMIT 1").get();
if (!admin) { console.log('❌ No admin user'); process.exit(1); }
console.log(`✅ Admin: ${admin.id.substring(0,8)} (${admin.fullName})\n`);

// Listar conversaciones
const conversations = db.prepare(`
    SELECT c.*, 
           ua.role as adminRole, ua.fullName as adminName,
           us.role as studentRole, us.fullName as studentName
    FROM Conversation c
    JOIN User ua ON c.adminId = ua.id
    JOIN User us ON c.studentId = us.id
`).all();

console.log(`💬 ${conversations.length} conversaciones encontradas\n`);

for (const conv of conversations) {
    const msgs = db.prepare("SELECT COUNT(*) as c FROM DirectMessage WHERE conversationId = ?").get(conv.id).c;
    const isCorrupt = conv.adminRole !== 'admin' || conv.studentRole !== 'student';
    
    if (!isCorrupt) {
        console.log(`   ✅ ${conv.id.substring(0,8)} | Admin(${conv.adminName}) ↔ Student(${conv.studentName}) | ${msgs} msgs`);
        continue;
    }
    
    console.log(`   ❌ ${conv.id.substring(0,8)} | ${conv.adminName}(${conv.adminRole}) ↔ ${conv.studentName}(${conv.studentRole}) | ${msgs} msgs`);
    
    // Determinar los estudiantes reales involucrados
    const participants = new Set();
    if (conv.adminRole === 'student') participants.add(conv.adminId);
    if (conv.studentRole === 'student') participants.add(conv.studentId);
    
    // Si hay un teacher involucrado, tratar como admin si corresponde
    if (conv.adminRole === 'teacher') participants.add(conv.studentId); // studentId es el real 
    if (conv.studentRole === 'teacher') participants.add(conv.adminId);

    // Para cada estudiante real, asegurar conversación correcta con admin
    for (const studentId of participants) {
        if (studentId === admin.id) continue; // No crear conv admin consigo mismo
        
        // ¿Ya existe una conv correcta?
        let correctConv = db.prepare(
            "SELECT id FROM Conversation WHERE adminId = ? AND studentId = ?"
        ).get(admin.id, studentId);
        
        if (!correctConv) {
            // Crear conversación correcta
            const newId = crypto.randomUUID();
            db.prepare(`
                INSERT INTO Conversation (id, adminId, studentId, lastMessage, lastMessageAt, createdAt)
                VALUES (?, ?, ?, NULL, NULL, datetime('now'))
            `).run(newId, admin.id, studentId);
            correctConv = { id: newId };
            console.log(`      📦 Creada conv correcta ${newId.substring(0,8)} para estudiante ${studentId.substring(0,8)}`);
        }
        
        // Mover mensajes que involucren a este estudiante
        // Cambiar senderId donde era un estudiante haciendo de admin → admin real
        const movedMsgs = db.prepare(`
            UPDATE DirectMessage 
            SET conversationId = ?, senderId = CASE 
                WHEN senderId = ? THEN ? 
                ELSE senderId 
            END
            WHERE conversationId = ? AND (senderId = ? OR senderId = ?)
        `).run(
            correctConv.id, 
            conv.adminId, admin.id,  // Si el sender era el "admin falso", cambiarlo al admin real
            conv.id, 
            conv.adminId, conv.studentId
        );
        
        if (movedMsgs.changes > 0) {
            console.log(`      📨 ${movedMsgs.changes} mensajes migrados a conv ${correctConv.id.substring(0,8)}`);
            
            // Actualizar lastMessage de la conv correcta
            const lastMsg = db.prepare(`
                SELECT content, createdAt, messageType FROM DirectMessage 
                WHERE conversationId = ? ORDER BY createdAt DESC LIMIT 1
            `).get(correctConv.id);
            
            if (lastMsg) {
                db.prepare("UPDATE Conversation SET lastMessage = ?, lastMessageAt = ? WHERE id = ?")
                    .run(lastMsg.content?.substring(0, 100) || '', lastMsg.createdAt, correctConv.id);
            }
        }
    }
    
    // Eliminar mensajes huérfanos restantes de la conv corrupta
    const remainingMsgs = db.prepare("DELETE FROM DirectMessage WHERE conversationId = ?").run(conv.id);
    if (remainingMsgs.changes > 0) {
        console.log(`      🗑️ ${remainingMsgs.changes} mensajes huérfanos eliminados`);
    }
    
    // Eliminar conversación corrupta
    db.prepare("DELETE FROM Conversation WHERE id = ?").run(conv.id);
    console.log(`      🗑️ Conversación corrupta eliminada`);
}

// Verificación final
console.log('\n📋 Estado final:');
const finalConvs = db.prepare(`
    SELECT c.id, ua.fullName as adminName, us.fullName as studentName, ua.role as ar, us.role as sr
    FROM Conversation c
    JOIN User ua ON c.adminId = ua.id
    JOIN User us ON c.studentId = us.id
`).all();

for (const c of finalConvs) {
    const msgs = db.prepare("SELECT COUNT(*) as cnt FROM DirectMessage WHERE conversationId = ?").get(c.id).cnt;
    console.log(`   ✅ ${c.id.substring(0,8)} | ${c.adminName}(${c.ar}) ↔ ${c.studentName}(${c.sr}) | ${msgs} msgs`);
}

// Verificar mensajes con senderId inválido
const badMsgs = db.prepare(`
    SELECT dm.id FROM DirectMessage dm
    JOIN Conversation c ON dm.conversationId = c.id
    WHERE dm.senderId != c.adminId AND dm.senderId != c.studentId
`).all();

if (badMsgs.length > 0) {
    console.log(`\n⚠️ ${badMsgs.length} mensajes con senderId inválido — corrigiendo...`);
    db.prepare(`
        UPDATE DirectMessage SET senderId = (
            SELECT c.adminId FROM Conversation c WHERE c.id = DirectMessage.conversationId
        )
        WHERE id IN (
            SELECT dm.id FROM DirectMessage dm
            JOIN Conversation c ON dm.conversationId = c.id
            WHERE dm.senderId != c.adminId AND dm.senderId != c.studentId
        )
    `).run();
    console.log('   ✅ Corregidos');
} else {
    console.log('\n✅ Todos los mensajes con senderId válido');
}

console.log('\n═══════════════════════════════════════════');
console.log('  ✅ Reparación completada');
console.log('═══════════════════════════════════════════');

db.close();
