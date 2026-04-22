/**
 * Página do Dashboard
 *
 * Responsabilidades:
 * - carregar dados básicos do atleta autenticado
 * - buscar estatísticas consolidadas do dashboard
 * - exibir ações rápidas para navegação
 * - mostrar atividade recente das sessões
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase/config.js';
import {
  getCurrentUserProfile,
  getDashboardStats,
  formatDateTimeForDisplay,
} from '../services/sessionService.js';

export default function DashboardPage() {
  const navigate = useNavigate();

  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalMinutes: 0,
    totalHoursLabel: '0h',
    recentActivities: [],
  });
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    /**
     * Ao entrar na página, observa o usuário autenticado
     * e carrega os dados necessários para o dashboard.
     */
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setLoading(true);

        if (!user) {
          setUserInfo(null);
          setProfile(null);
          setStats({
            totalSessions: 0,
            totalMinutes: 0,
            totalHoursLabel: '0h',
            recentActivities: [],
          });
          return;
        }

        setUserInfo(user);

        /**
         * O perfil vem da coleção /users
         * e as métricas vêm centralizadas do sessionService.
         */
        const [profileData, dashboardStats] = await Promise.all([
          getCurrentUserProfile(user.uid),
          getDashboardStats(user.uid),
        ]);

        setProfile(profileData);
        setStats(dashboardStats);
      } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="dashboard-page">Carregando...</div>;
  }

  const displayName = profile?.nome || userInfo?.displayName || 'Atleta';

  return (
    <div className="dashboard-page" style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Painel do atleta</p>
          <h1 style={styles.title}>Dashboard</h1>
          <p style={styles.subtitle}>Olá, {displayName}</p>
        </div>
      </header>

      <main style={styles.content}>
        <section style={styles.statsSection}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Estatísticas</h2>
            <span style={styles.badge}>Atualizado agora</span>
          </div>

          <div style={styles.statsGrid}>
            <div style={styles.card}>
              <span style={styles.cardLabel}>Total de sessões</span>
              <strong style={styles.cardValue}>{stats.totalSessions}</strong>
            </div>

            <div style={styles.card}>
              <span style={styles.cardLabel}>Horas registradas</span>
              <strong style={styles.cardValue}>{stats.totalHoursLabel}</strong>
            </div>
          </div>
        </section>

        <section style={styles.actionsSection}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Ações rápidas</h2>
          </div>

          <div style={styles.actionsGrid}>
            {/* Navegação rápida para o fluxo principal do atleta */}
            <button
              style={styles.primaryButton}
              onClick={() => navigate('/checkin')}
            >
              Check-in
            </button>

            <button
              style={styles.secondaryButton}
              onClick={() => navigate('/checkout')}
            >
              Check-out
            </button>

            <button
              style={styles.secondaryButton}
              onClick={() => navigate('/avaliacao')}
            >
              Avaliação
            </button>
          </div>
        </section>

        <section style={styles.recentSection}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Atividade recente</h2>
          </div>

          <div style={styles.activityList}>
            {stats.recentActivities.length === 0 ? (
              <div style={styles.emptyState}>Nenhuma atividade registrada</div>
            ) : (
              stats.recentActivities.map((item, index) => (
                <article
                  key={`${item.id || 'sessao'}-${item.dataCheckin?.seconds || item.dataCheckout?.seconds || index}`}
                  style={styles.activityCard}
                >
                  <div style={styles.activityTopRow}>
                    <strong style={styles.activityTitle}>
                      {item.atividades?.[0] || 'Sessão de treino'}
                    </strong>
                    <span style={styles.activityDuration}>
                      {item.duracaoMin ? `${item.duracaoMin} min` : 'N/D'}
                    </span>
                  </div>

                  {/* Exibe check-in e check-out formatados de forma padronizada */}
                  <div style={styles.activityMeta}>
                    <span>Check-in: {formatDateTimeForDisplay(item.dataCheckin)}</span>
                    <span>Check-out: {formatDateTimeForDisplay(item.dataCheckout)}</span>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f5f7fb',
    padding: '32px 20px 48px',
    fontFamily: 'Arial, sans-serif',
    color: '#1f2937',
  },
  header: {
    maxWidth: '960px',
    margin: '0 auto 24px',
  },
  eyebrow: {
    margin: 0,
    fontSize: '14px',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  title: {
    margin: '8px 0 4px',
    fontSize: '48px',
    lineHeight: 1.1,
  },
  subtitle: {
    margin: 0,
    fontSize: '18px',
    color: '#4b5563',
  },
  content: {
    maxWidth: '960px',
    margin: '0 auto',
    display: 'grid',
    gap: '24px',
  },
  statsSection: {
    background: '#ffffff',
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
  },
  actionsSection: {
    background: '#ffffff',
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
  },
  recentSection: {
    background: '#ffffff',
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '24px',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 10px',
    borderRadius: '999px',
    background: '#e0f2fe',
    color: '#0369a1',
    fontSize: '12px',
    fontWeight: 700,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
  },
  card: {
    background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)',
    color: '#ffffff',
    borderRadius: '18px',
    padding: '20px',
  },
  cardLabel: {
    display: 'block',
    fontSize: '14px',
    color: '#cbd5e1',
    marginBottom: '8px',
  },
  cardValue: {
    fontSize: '36px',
    lineHeight: 1.1,
  },
  actionsGrid: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  primaryButton: {
    border: 'none',
    borderRadius: '12px',
    padding: '12px 18px',
    background: '#2563eb',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondaryButton: {
    border: '1px solid #cbd5e1',
    borderRadius: '12px',
    padding: '12px 18px',
    background: '#ffffff',
    color: '#1f2937',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  activityList: {
    display: 'grid',
    gap: '14px',
  },
  activityCard: {
    border: '1px solid #e5e7eb',
    borderRadius: '16px',
    padding: '16px',
    background: '#f9fafb',
  },
  activityTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '8px',
  },
  activityTitle: {
    fontSize: '18px',
  },
  activityDuration: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#2563eb',
  },
  activityMeta: {
    display: 'grid',
    gap: '6px',
    fontSize: '14px',
    color: '#4b5563',
  },
  emptyState: {
    padding: '24px',
    textAlign: 'center',
    borderRadius: '16px',
    background: '#f9fafb',
    color: '#6b7280',
  },
};