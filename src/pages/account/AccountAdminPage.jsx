import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  getAccount,
  getPlan,
  canAddAthlete,
  linkAthleteChecked,
} from '../../services/accountService.js';
import {
  getAccountActiveAthleteLinks,
  deactivateAthleteLink,
} from '../../services/athleteLinkService.js';
import { getUserProfile, listUsers } from '../../services/userService.js';
import { AccountSummaryCard } from '../../components/account/AccountSummaryCard.jsx';
import { AthleteLinksTable } from '../../components/account/AthleteLinksTable.jsx';

export default function AccountAdminPage() {
  const { user, profile } = useAuth();
  const [account, setAccount] = useState(null);
  const [plan, setPlan] = useState(null);
  const [limitInfo, setLimitInfo] = useState(null);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showLinkForm, setShowLinkForm] = useState(false);
  const [selectableAthletes, setSelectableAthletes] = useState([]);
  const [selectableTrainers, setSelectableTrainers] = useState([]);
  const [linkForm, setLinkForm] = useState({ athleteId: '', trainerId: '' });
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState(null);
  const [unlinkingId, setUnlinkingId] = useState(null);

  const accountId = profile?.accountId;

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setError(null);
    try {
      const accountData = await getAccount(accountId);
      if (!accountData) throw new Error('Conta não encontrada.');

      const [planData, limitData, rawLinks] = await Promise.all([
        getPlan(accountData.planId),
        canAddAthlete(accountId),
        getAccountActiveAthleteLinks(accountId),
      ]);

      const enriched = await Promise.all(
        rawLinks.map(async (link) => ({
          ...link,
          athlete: await getUserProfile(link.athleteId),
        }))
      );

      setAccount(accountData);
      setPlan(planData);
      setLimitInfo(limitData);
      setLinks(
        enriched.sort((a, b) =>
          String(a.athlete?.displayName || a.athlete?.email || '').localeCompare(
            String(b.athlete?.displayName || b.athlete?.email || ''),
            'pt-BR'
          )
        )
      );
    } catch (err) {
      setError(err.message || 'Erro ao carregar dados da conta.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleOpenLinkForm() {
    setShowLinkForm(true);
    setLinkError(null);
    setLinkForm({ athleteId: '', trainerId: '' });
    setSelectableAthletes([]);
    setSelectableTrainers([]);
    try {
      const [trainerList, coachList, athleteList] = await Promise.all([
        listUsers({ papel: 'trainer', accountId }),
        listUsers({ papel: 'coach', accountId }),
        listUsers({ papel: 'athlete', accountId }),
      ]);
      const linkedIds = new Set(links.map((l) => l.athleteId));
      setSelectableAthletes(athleteList.filter((a) => !linkedIds.has(a.uid)));
      setSelectableTrainers(
        [...trainerList, ...coachList].sort((a, b) =>
          String(a.displayName || '').localeCompare(String(b.displayName || ''), 'pt-BR')
        )
      );
    } catch (err) {
      setLinkError('Erro ao carregar opções de vínculo.');
      console.error(err);
    }
  }

  async function handleLink() {
    const { athleteId, trainerId } = linkForm;
    if (!athleteId || !trainerId) {
      setLinkError('Selecione o atleta e o treinador.');
      return;
    }
    setLinking(true);
    setLinkError(null);
    try {
      await linkAthleteChecked(athleteId, trainerId, accountId, user.uid);
      setShowLinkForm(false);
      await load();
    } catch (err) {
      if (err.code === 'limit_reached') {
        setLinkError(
          `Limite de atletas ativos atingido (${err.count}/${err.limit}). ` +
            `Desative um vínculo antes de vincular outro.`
        );
      } else {
        setLinkError(err.message || 'Erro ao criar vínculo.');
      }
    } finally {
      setLinking(false);
    }
  }

  async function handleDeactivate(link) {
    const name = link.athlete?.displayName || link.athleteId;
    if (!window.confirm(`Desvincular "${name}"? O atleta deixará de contar no limite ativo.`)) return;
    setUnlinkingId(link.linkId);
    try {
      await deactivateAthleteLink(link.athleteId, link.trainerId, user.uid);
      await load();
    } catch (err) {
      alert('Erro ao desvincular: ' + err.message);
    } finally {
      setUnlinkingId(null);
    }
  }

  if (!accountId) {
    return (
      <div style={styles.page}>
        <p style={styles.errorText}>Seu perfil não está associado a nenhuma conta.</p>
      </div>
    );
  }

  const atLimit = limitInfo != null && !limitInfo.allowed;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Administração da conta</p>
          <h1 style={styles.title}>{account?.name || 'Minha conta'}</h1>
        </div>
      </div>

      {loading && <p style={styles.hint}>Carregando...</p>}
      {error && <p style={styles.errorText}>{error}</p>}

      {!loading && !error && account && (
        <>
          <AccountSummaryCard account={account} plan={plan} limitInfo={limitInfo} />

          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Atletas vinculados</h2>
            {atLimit ? (
              <span style={styles.limitBadge}>
                Limite atingido ({limitInfo.count}/{limitInfo.limit})
              </span>
            ) : (
              <button style={styles.btnPrimary} onClick={handleOpenLinkForm}>
                + Vincular atleta
              </button>
            )}
          </div>

          {showLinkForm && (
            <div style={styles.linkFormBox}>
              <p style={styles.linkFormTitle}>Novo vínculo</p>
              <div style={styles.linkFormRow}>
                <select
                  style={styles.select}
                  value={linkForm.athleteId}
                  onChange={(e) =>
                    setLinkForm((f) => ({ ...f, athleteId: e.target.value }))
                  }
                >
                  <option value="">Atleta...</option>
                  {selectableAthletes.map((a) => (
                    <option key={a.uid} value={a.uid}>
                      {a.displayName || a.email}
                    </option>
                  ))}
                </select>
                <select
                  style={styles.select}
                  value={linkForm.trainerId}
                  onChange={(e) =>
                    setLinkForm((f) => ({ ...f, trainerId: e.target.value }))
                  }
                >
                  <option value="">Treinador...</option>
                  {selectableTrainers.map((t) => (
                    <option key={t.uid} value={t.uid}>
                      {t.displayName || t.email}
                    </option>
                  ))}
                </select>
                <button
                  style={styles.btnPrimary}
                  onClick={handleLink}
                  disabled={linking}
                >
                  {linking ? 'Vinculando…' : 'Vincular'}
                </button>
                <button
                  style={styles.btnSecondary}
                  onClick={() => setShowLinkForm(false)}
                >
                  Cancelar
                </button>
              </div>
              {linkError && <p style={styles.errorText}>{linkError}</p>}
              {!linkError && selectableAthletes.length === 0 && selectableTrainers.length > 0 && (
                <p style={styles.hint}>
                  Nenhum atleta disponível para vincular nesta conta.
                </p>
              )}
              {!linkError && selectableTrainers.length === 0 && (
                <p style={styles.hint}>
                  Nenhum treinador encontrado nesta conta.
                </p>
              )}
            </div>
          )}

          <AthleteLinksTable
            links={links}
            unlinkingId={unlinkingId}
            onDeactivate={handleDeactivate}
          />
        </>
      )}
    </div>
  );
}

const styles = {
  page: {
    display: 'grid',
    gap: '20px',
    padding: '24px',
    maxWidth: '960px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
    flexWrap: 'wrap',
  },
  eyebrow: {
    margin: 0,
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: '#475569',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 700,
    color: '#0f172a',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 700,
    color: '#0f172a',
  },
  limitBadge: {
    padding: '6px 12px',
    borderRadius: '8px',
    background: '#fee2e2',
    color: '#dc2626',
    fontSize: '13px',
    fontWeight: 600,
  },
  linkFormBox: {
    padding: '16px',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    display: 'grid',
    gap: '12px',
  },
  linkFormTitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 700,
    color: '#0f172a',
  },
  linkFormRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  select: {
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    fontSize: '14px',
    color: '#0f172a',
    minWidth: '180px',
    flex: '1 1 180px',
  },
  btnPrimary: {
    padding: '9px 16px',
    borderRadius: '8px',
    border: 'none',
    background: '#1d4ed8',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnSecondary: {
    padding: '9px 16px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#374151',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  hint: { color: '#64748b', fontSize: '14px' },
  errorText: { color: '#dc2626', fontSize: '14px' },
};
