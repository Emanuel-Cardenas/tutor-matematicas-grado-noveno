import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

/**
 * GET /api/uploads/[...filepath]
 * Servir archivos subidos (mensajes, etc.)
 */
export async function GET(request, { params }) {
    try {
        const { filepath } = await params;
        const filePath = path.resolve(process.cwd(), 'uploads', ...filepath);

        // Seguridad: verificar que el path no sale de uploads/
        const uploadsDir = path.resolve(process.cwd(), 'uploads');
        if (!filePath.startsWith(uploadsDir)) {
            return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
        }

        const buffer = await readFile(filePath);

        // Determinar content type
        const ext = path.extname(filePath).toLowerCase();
        const contentTypes = {
            '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
            '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf',
            '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        };

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': contentTypes[ext] || 'application/octet-stream',
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (error) {
        return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }
}
