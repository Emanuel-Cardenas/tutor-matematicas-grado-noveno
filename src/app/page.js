'use client';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';

// ═══ Configuración de roles (escalable) ═══
const ROLES = [
  {
    id: 'student',
    icon: '👨‍🎓',
    title: 'Soy Estudiante',
    desc: 'Accede a tu tutor inteligente, diagnósticos personalizados y seguimiento de progreso.',
    href: '/login',
    iconClass: 'student',
  },
  {
    id: 'admin',
    icon: '👨‍💼',
    title: 'Soy Administrador',
    desc: 'Gestiona estudiantes, analíticas grupales y contenidos del sistema.',
    href: '/admin',
    iconClass: 'admin',
  },
  {
    id: 'parent',
    icon: '👨‍👩‍👧',
    title: 'Soy Padre de Familia',
    desc: 'Acompaña el aprendizaje de tu hijo con reportes y seguimiento académico.',
    href: '/parent',
    iconClass: 'parent',
  },
];

export default function PortalPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);

  // ═══ Auto-redirect para usuarios autenticados ═══
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      setRedirecting(true);
      const role = session.user.role;
      if (role === 'admin') {
        router.push('/admin/dashboard');
      } else {
        router.push('/dashboard');
      }
    }
  }, [status, session, router]);

  // Check parents via sessionStorage (client-side only)
  useEffect(() => {
    if (status === 'unauthenticated') {
      const parentToken = sessionStorage.getItem('parentToken');
      if (parentToken) {
        setRedirecting(true);
        router.push('/parent/dashboard');
      }
    }
  }, [status, router]);

  // ═══ Loading state ═══
  if (status === 'loading' || redirecting) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p className="loading-text">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="portal-page">
      {/* ── Header ── */}
      <header className="portal-header">
        <div className="portal-brand">
          <div className="portal-logo">YT</div>
          <div className="portal-brand-text">
            <h1>YedaTech</h1>
            <span>Tutor Académico Inteligente</span>
          </div>
        </div>
        <ThemeToggle />
      </header>

      {/* ── Main ── */}
      <main className="portal-main">
        <div className="portal-hero">
          <h2>
            Bienvenido a <span className="gradient-text">YedaTech</span>
          </h2>
          <p>Selecciona tu perfil para comenzar</p>
        </div>

        <div className="portal-cards">
          {ROLES.map((role) => (
            <Link
              key={role.id}
              href={role.href}
              className="portal-card"
              id={`portal-card-${role.id}`}
            >
              <div className={`portal-card-icon ${role.iconClass}`}>
                {role.icon}
              </div>
              <div className="portal-card-title">{role.title}</div>
              <div className="portal-card-desc">{role.desc}</div>
              <div className="portal-card-btn">Ingresar →</div>
            </Link>
          ))}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="portal-footer">
        <a href="mailto:soporte@yedatech.com">Soporte</a>
        <div className="portal-footer-divider" />
        <a href="#">Ayuda</a>
        <div className="portal-footer-divider" />
        <a href="#">Términos de uso</a>
        {session && (
          <>
            <div className="portal-footer-divider" />
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                signOut({ callbackUrl: '/' });
              }}
            >
              Cerrar Sesión
            </a>
          </>
        )}
      </footer>
    </div>
  );
}
