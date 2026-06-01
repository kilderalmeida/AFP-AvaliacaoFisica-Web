import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  getAccount,
  getPlan,
  canAddAthlete,
  linkAthleteChecked,
  transferAthleteWithBatch,
  updateAccount,
} from '../../services/accountService.js';
import {
  getAccountActiveAthleteLinks,
  getAccountInactiveAthleteLinks,
  deactivateAthleteLink,
  reactivateAthleteLink,
} from '../../services/athleteLinkService.js';
import { createUser, getUserProfile, listUsers, sendInviteEmail, toggleUserStatus } from '../../services/userService.js';
import { AccountSummaryCard } from '../../components/account/AccountSummaryCard.jsx';
import { AthleteLinksTable } from '../../components/account/AthleteLinksTable.jsx';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import { EmptyStateCard } from '../../components/feedback/EmptyStateCard.jsx';
import { ErrorStateCard } from '../../components/feedback/ErrorStateCard.jsx';

export default function AccountAdminPage() {
  const { user, profile } = useAuth();
  const [account, setAccount] = useState(null);
  const [plan, setPlan] = useState(null);
  const [limitInfo, setLimitInfo] = useState(null);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [resendingEmail, setResendingEmail] = useState(null);
  const [resendFeedback, setResendFeedback] = useState(null);
  const [togglingTrainer, setTogglingTrainer] = useState(null);

  const [trainers, setTrainers] = useState([]);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', displayName: '', papel: 'trainer' });
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [inviteSuccess, setInviteSuccess] = useState(null);

  const [activeTab, setActiveTab] = useState('active');
  const [inactiveLinks, setInactiveLinks] = useState([]);
  const [reactivatingId, setReactivatingId] = useState(null);
  const [reactivateError, setReactivateError] = useState(null);

  const [showLinkForm, setShowLinkForm] = useState(false);
  const [selectableAthletes, setSelectableAthletes] = useState([]);
  const [selectableTrainers, setSelectableTrainers] = useState([]);
  const [linkForm, setLinkForm] = useState({ athleteId: '', trainerId: '' });
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState(null);
  const [unlinkingId, setUnlinkingId] = useState(null);
  const [showInviteAthleteForm, setShowInviteAthleteForm] = useState(false);
  const [inviteAthleteForm, setInviteAthleteForm] = useState({ email: '', displayName: '', trainerId: '' });
  const [invitingAthlete, setInvitingAthlete] = useState(false);
  const [inviteAthleteError, setInviteAthleteError] = useState(null);
  const [inviteAthleteSuccess, setInviteAthleteSuccess] = useState(null);
  const [selectableStaff, setSelectableStaff] = useState([]);

  const [transferTarget, setTransferTarget] = useState(null);
  const [transferTrainerId, setTransferTrainerId] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState(null);

  const [editingInfo, setEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({ name: '', cnpj: '', address: '', phone: '', contactEmail: '' });
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoError, setInfoError] = useState(null);
  const [infoSuccess, setInfoSuccess] = useState(null);

  const accountId = profile?.accountId;

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setError(null);
    try {
      const accountData = await getAccount(accountId);
      if (!accountData) throw new Error('Conta não encontrada.');

      const [planData, limitData, rawLinks, rawInactiveLinks, trainersData, coachesData] = await Promise.all([
        getPlan(accountData.planId),
        canAddAthlete(accountId),
        getAccountActiveAthleteLinks(accountId),
        getAccountInactiveAthleteLinks(accountId),
        listUsers({ papel: 'trainer', accountId }),
        listUsers({ papel: 'coach', accountId }),
      ]);

      const sortByName = (a, b) =>
        String(a.athlete?.displayName || a.athlete?.email || '').localeCompare(
          String(b.athlete?.displayName || b.athlete?.email || ''),
          'pt-BR'
        );

      const enrich = (link) =>
        getUserProfile(link.athleteId).then((athlete) => ({ ...link, athlete }));

      const [enriched, enrichedInactive] = await Promise.all([
        Promise.all(rawLinks.map(enrich)),
        Promise.all(rawInactiveLinks.map(enrich)),
      ]);

      setAccount(accountData);
      setPlan(planData);
      setLimitInfo(limitData);
      setLinks(enriched.sort(sortByName));
      setInactiveLinks(enrichedInactive.sort(sortByName));
      setTrainers(
        [...trainersData, ...coachesData].sort((a, b) =>
          String(a.displayName || a.email || '').localeCompare(
            String(b.displayName || b.email || ''), 'pt-BR'
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
      const linkedIds = new Set([
        ...links.map((l) => l.athleteId),
        ...inactiveLinks.map((l) => l.athleteId),
      ]);
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

  async function handleReactivate(link) {
    setReactivateError(null);
    const limitData = await canAddAthlete(accountId);
    if (!limitData.allowed) {
      setReactivateError(
        `Limite de atletas ativos atingido (${limitData.count}/${limitData.limit}). ` +
          `Desative um vínculo antes de reativar.`
      );
      return;
    }
    const name = link.athlete?.displayName || link.athleteId;
    if (!window.confirm(`Reativar vínculo de "${name}"?`)) return;
    setReactivatingId(link.linkId);
    try {
      await reactivateAthleteLink(link.athleteId, link.trainerId, user.uid);
      await load();
    } catch (err) {
      setReactivateError('Erro ao reativar: ' + err.message);
    } finally {
      setReactivatingId(null);
    }
  }

  async function handleResendInvite(email) {
    setResendingEmail(email);
    setResendFeedback(null);
    try {
      await sendInviteEmail(email);
      setResendFeedback({ success: true, message: `Convite reenviado para ${email}.` });
    } catch (err) {
      setResendFeedback({
        success: false,
        message: `Erro ao reenviar para ${email}: ${err.message || 'tente novamente.'}`,
      });
    } finally {
      setResendingEmail(null);
    }
  }

  async function handleToggleTrainerStatus(trainer) {
    const newStatus = trainer.status === 'inactive' ? 'active' : 'inactive';
    setTogglingTrainer(trainer.uid);
    try {
      await toggleUserStatus(trainer.uid, newStatus, user.uid);
      setTrainers((prev) =>
        prev.map((t) => (t.uid === trainer.uid ? { ...t, status: newStatus } : t))
      );
    } catch (err) {
      alert('Erro ao atualizar status: ' + (err.message || 'tente novamente.'));
    } finally {
      setTogglingTrainer(null);
    }
  }

  async function handleOpenTransferForm(link) {
    setTransferTarget(link);
    setTransferTrainerId('');
    setTransferError(null);
    setShowLinkForm(false);
    setShowInviteAthleteForm(false);
    setInviteAthleteSuccess(null);
    setSelectableStaff([]);
    try {
      const [trainerList, coachList] = await Promise.all([
        listUsers({ papel: 'trainer', accountId }),
        listUsers({ papel: 'coach', accountId }),
      ]);
      setSelectableStaff(
        [...trainerList, ...coachList]
          .filter((t) => t.uid !== link.trainerId)
          .sort((a, b) =>
            String(a.displayName || '').localeCompare(String(b.displayName || ''), 'pt-BR')
          )
      );
    } catch { /* non-critical — dropdown stays empty */ }
  }

  async function handleTransfer() {
    if (!transferTrainerId) {
      setTransferError('Selecione o novo treinador.');
      return;
    }
    setTransferring(true);
    setTransferError(null);
    try {
      await transferAthleteWithBatch(
        transferTarget.athleteId,
        transferTarget.trainerId,
        transferTrainerId,
        accountId,
        user.uid
      );
      setTransferTarget(null);
      await load();
    } catch (err) {
      setTransferError(err.message || 'Erro ao transferir atleta.');
    } finally {
      setTransferring(false);
    }
  }

  async function handleOpenInviteAthleteForm() {
    setShowInviteAthleteForm(true);
    setTransferTarget(null);
    setShowLinkForm(false);
    setInviteAthleteError(null);
    setInviteAthleteSuccess(null);
    setInviteAthleteForm({ email: '', displayName: '', trainerId: '' });
    setSelectableStaff([]);
    try {
      const [trainerList, coachList] = await Promise.all([
        listUsers({ papel: 'trainer', accountId }),
        listUsers({ papel: 'coach', accountId }),
      ]);
      setSelectableStaff(
        [...trainerList, ...coachList].sort((a, b) =>
          String(a.displayName || '').localeCompare(String(b.displayName || ''), 'pt-BR')
        )
      );
    } catch { /* non-critical — trainer dropdown stays empty */ }
  }

  async function handleInviteAthlete() {
    const { email, displayName, trainerId } = inviteAthleteForm;
    if (!email.trim() || !displayName.trim()) {
      setInviteAthleteError('E-mail e nome são obrigatórios.');
      return;
    }
    setInviteAthleteError(null);
    setInviteAthleteSuccess(null);
    if (trainerId) {
      const limitData = await canAddAthlete(accountId);
      if (!limitData.allowed) {
        setInviteAthleteError(
          `Limite de atletas ativos atingido (${limitData.count}/${limitData.limit}). ` +
            `Selecione "Sem treinador" para criar o atleta sem vínculo.`
        );
        return;
      }
    }
    setInvitingAthlete(true);
    try {
      const newUid = await createUser(
        { email: email.trim(), displayName: displayName.trim(), papel: 'athlete', status: 'invited', accountId },
        user.uid
      );
      if (trainerId) {
        await linkAthleteChecked(newUid, trainerId, accountId, user.uid);
      }
      const trainerName = selectableStaff.find((t) => t.uid === trainerId)?.displayName || trainerId;
      setInviteAthleteSuccess(
        trainerId
          ? `Atleta "${displayName.trim()}" convidado e vinculado a ${trainerName}.`
          : `Atleta "${displayName.trim()}" convidado. Use "+ Vincular atleta" para criar o vínculo quando necessário.`
      );
      setShowInviteAthleteForm(false);
      setInviteAthleteForm({ email: '', displayName: '', trainerId: '' });
      await load();
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setInviteAthleteError('Este e-mail já está cadastrado na plataforma.');
      } else if (err.code === 'limit_reached') {
        setInviteAthleteError(
          `Atleta criado, mas limite de vínculos atingido. Use "+ Vincular atleta" quando houver capacidade.`
        );
        await load();
      } else {
        setInviteAthleteError(err.message || 'Erro ao convidar atleta.');
      }
    } finally {
      setInvitingAthlete(false);
    }
  }

  async function handleInviteTrainer() {
    const { email, displayName, papel } = inviteForm;
    if (!email.trim() || !displayName.trim()) {
      setInviteError('E-mail e nome são obrigatórios.');
      return;
    }
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      await createUser(
        { email: email.trim(), displayName: displayName.trim(), papel, status: 'invited', accountId },
        user.uid
      );
      const roleLabel = papel === 'coach' ? 'coach' : 'trainer';
      setInviteSuccess(`Convite enviado para ${email.trim()}. O ${roleLabel} receberá um e-mail para criar sua senha.`);
      setShowInviteForm(false);
      setInviteForm({ email: '', displayName: '', papel: 'trainer' });
      await load();
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setInviteError('Este e-mail já está cadastrado na plataforma.');
      } else {
        setInviteError(err.message || 'Erro ao convidar.');
      }
    } finally {
      setInviting(false);
    }
  }

  function handleOpenInfoForm() {
    setEditingInfo(true);
    setInfoError(null);
    setInfoSuccess(null);
    setInfoForm({
      name: account?.name || '',
      cnpj: account?.cnpj || '',
      address: account?.address || '',
      phone: account?.phone || '',
      contactEmail: account?.contactEmail || '',
    });
  }

  async function handleSaveInfo() {
    if (!infoForm.name.trim()) {
      setInfoError('Nome da academia é obrigatório.');
      return;
    }
    setSavingInfo(true);
    setInfoError(null);
    try {
      const patch = {
        name: infoForm.name.trim(),
        cnpj: infoForm.cnpj.trim(),
        address: infoForm.address.trim(),
        phone: infoForm.phone.trim(),
        contactEmail: infoForm.contactEmail.trim(),
      };
      await updateAccount(accountId, patch, user.uid);
      setAccount((prev) => ({ ...prev, ...patch }));
      setEditingInfo(false);
      setInfoSuccess('Dados salvos com sucesso.');
    } catch (err) {
      setInfoError(err.message || 'Erro ao salvar dados.');
    } finally {
      setSavingInfo(false);
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

      {loading && (
        <EmptyStateCard title="Carregando..." message="Buscando dados da conta." />
      )}
      {!loading && error && (
        <ErrorStateCard title="Erro ao carregar dados da conta" message={error} onAction={load} />
      )}

      {!loading && !error && account && (
        <>
          <AccountSummaryCard
            account={account}
            plan={plan}
            limitInfo={limitInfo}
            upgradeUrl={import.meta.env.VITE_UPGRADE_URL || ''}
          />

          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Dados da academia</h2>
            {!editingInfo && (
              <button style={styles.btnSecondary} onClick={handleOpenInfoForm}>
                Editar
              </button>
            )}
          </div>

          {editingInfo ? (
            <div style={styles.linkFormBox}>
              <div style={styles.infoFormGrid}>
                <label style={styles.infoLabel}>
                  Nome *
                  <input
                    style={styles.select}
                    type="text"
                    value={infoForm.name}
                    onChange={(e) => setInfoForm((f) => ({ ...f, name: e.target.value }))}
                    disabled={savingInfo}
                    placeholder="Nome da academia"
                  />
                </label>
                <label style={styles.infoLabel}>
                  CNPJ
                  <input
                    style={styles.select}
                    type="text"
                    value={infoForm.cnpj}
                    onChange={(e) => setInfoForm((f) => ({ ...f, cnpj: e.target.value }))}
                    disabled={savingInfo}
                    placeholder="00.000.000/0000-00"
                  />
                </label>
                <label style={styles.infoLabel}>
                  Endereço
                  <input
                    style={styles.select}
                    type="text"
                    value={infoForm.address}
                    onChange={(e) => setInfoForm((f) => ({ ...f, address: e.target.value }))}
                    disabled={savingInfo}
                    placeholder="Rua, número, cidade — UF"
                  />
                </label>
                <label style={styles.infoLabel}>
                  Telefone
                  <input
                    style={styles.select}
                    type="tel"
                    value={infoForm.phone}
                    onChange={(e) => setInfoForm((f) => ({ ...f, phone: e.target.value }))}
                    disabled={savingInfo}
                    placeholder="(11) 99999-9999"
                  />
                </label>
                <label style={styles.infoLabel}>
                  E-mail de contato
                  <input
                    style={styles.select}
                    type="email"
                    value={infoForm.contactEmail}
                    onChange={(e) => setInfoForm((f) => ({ ...f, contactEmail: e.target.value }))}
                    disabled={savingInfo}
                    placeholder="contato@academia.com.br"
                  />
                </label>
              </div>
              <div style={styles.linkFormRow}>
                <button style={styles.btnPrimary} onClick={handleSaveInfo} disabled={savingInfo}>
                  {savingInfo ? 'Salvando…' : 'Salvar'}
                </button>
                <button
                  style={styles.btnSecondary}
                  onClick={() => setEditingInfo(false)}
                  disabled={savingInfo}
                >
                  Cancelar
                </button>
              </div>
              {infoError && <p style={styles.errorText}>{infoError}</p>}
            </div>
          ) : (
            <>
              <div style={styles.infoCard}>
                <InfoRow label="Nome" value={account?.name} />
                <InfoRow label="CNPJ" value={account?.cnpj} />
                <InfoRow label="Endereço" value={account?.address} />
                <InfoRow label="Telefone" value={account?.phone} />
                <InfoRow label="E-mail de contato" value={account?.contactEmail} />
              </div>
              {infoSuccess && <p style={styles.successText}>{infoSuccess}</p>}
            </>
          )}

          {resendFeedback && (
            <p style={resendFeedback.success ? styles.successText : styles.errorText}>
              {resendFeedback.message}
            </p>
          )}

          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Treinadores e Coaches</h2>
            <button
              style={styles.btnPrimary}
              onClick={() => {
                setShowInviteForm(true);
                setInviteError(null);
                setInviteSuccess(null);
                setInviteForm({ email: '', displayName: '', papel: 'trainer' });
              }}
            >
              + Convidar
            </button>
          </div>

          {showInviteForm && (
            <div style={styles.linkFormBox}>
              <p style={styles.linkFormTitle}>Convidar treinador ou coach</p>
              <div style={styles.linkFormRow}>
                <input
                  style={styles.select}
                  type="email"
                  placeholder="E-mail *"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                  disabled={inviting}
                />
                <input
                  style={styles.select}
                  type="text"
                  placeholder="Nome *"
                  value={inviteForm.displayName}
                  onChange={(e) => setInviteForm((f) => ({ ...f, displayName: e.target.value }))}
                  disabled={inviting}
                />
                <select
                  style={styles.select}
                  value={inviteForm.papel}
                  onChange={(e) => setInviteForm((f) => ({ ...f, papel: e.target.value }))}
                  disabled={inviting}
                >
                  <option value="trainer">Trainer</option>
                  <option value="coach">Coach</option>
                </select>
                <button style={styles.btnPrimary} onClick={handleInviteTrainer} disabled={inviting}>
                  {inviting ? 'Convidando…' : 'Convidar'}
                </button>
                <button style={styles.btnSecondary} onClick={() => setShowInviteForm(false)}>
                  Cancelar
                </button>
              </div>
              {inviteError && <p style={styles.errorText}>{inviteError}</p>}
            </div>
          )}

          {inviteSuccess && !showInviteForm && (
            <p style={styles.successText}>{inviteSuccess}</p>
          )}

          {trainers.length === 0 ? (
            <EmptyStateCard
              title="Nenhum trainer ou coach"
              message="Convide o primeiro para começar a montar a equipe da conta."
              action={
                <button
                  style={styles.btnPrimary}
                  onClick={() => {
                    setShowInviteForm(true);
                    setInviteError(null);
                    setInviteSuccess(null);
                    setInviteForm({ email: '', displayName: '', papel: 'trainer' });
                  }}
                >
                  + Convidar
                </button>
              }
            />
          ) : (
            <div style={styles.trainerTableWrapper}>
              <table style={styles.trainerTable}>
                <thead>
                  <tr>
                    <th style={styles.trainerTh}>Nome</th>
                    <th style={styles.trainerTh}>E-mail</th>
                    <th style={styles.trainerTh}>Papel</th>
                    <th style={{ ...styles.trainerTh, textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {trainers.map((t) => (
                    <tr key={t.uid} style={styles.trainerTr}>
                      <td style={styles.trainerTd}>{t.displayName || '—'}</td>
                      <td style={{ ...styles.trainerTd, color: '#64748b' }}>{t.email}</td>
                      <td style={styles.trainerTd}>
                        <StatusBadge kind="role" value={t.papel} />
                      </td>
                      <td style={{ ...styles.trainerTd, textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                          <StatusBadge kind="userStatus" value={t.status} />
                          {t.status === 'invited' && (
                            <button
                              style={styles.btnResend}
                              onClick={() => handleResendInvite(t.email)}
                              disabled={resendingEmail === t.email}
                            >
                              {resendingEmail === t.email ? 'Enviando…' : 'Reenviar convite'}
                            </button>
                          )}
                          {t.status !== 'invited' && (
                            <button
                              style={t.status === 'inactive' ? styles.btnReactivate : styles.btnDeactivate}
                              onClick={() => handleToggleTrainerStatus(t)}
                              disabled={togglingTrainer === t.uid}
                            >
                              {togglingTrainer === t.uid
                                ? '…'
                                : t.status === 'inactive' ? 'Reativar' : 'Desativar'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Vínculos de atletas</h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button style={styles.btnPrimary} onClick={handleOpenInviteAthleteForm}>
                + Convidar athlete
              </button>
              {activeTab === 'active' && (
                atLimit ? (
                  <span style={styles.limitBadge}>
                    Limite atingido ({limitInfo.count}/{limitInfo.limit})
                  </span>
                ) : (
                  <button
                    style={styles.btnSecondary}
                    onClick={() => {
                      handleOpenLinkForm();
                      setShowInviteAthleteForm(false);
                      setInviteAthleteSuccess(null);
                      setTransferTarget(null);
                    }}
                  >
                    + Vincular atleta
                  </button>
                )
              )}
            </div>
          </div>

          <div style={styles.tabRow}>
            <button
              style={activeTab === 'active' ? styles.tabActive : styles.tabInactive}
              onClick={() => { setActiveTab('active'); setShowLinkForm(false); setShowInviteAthleteForm(false); setTransferTarget(null); }}
            >
              Ativos ({links.length})
            </button>
            <button
              style={activeTab === 'inactive' ? styles.tabActive : styles.tabInactive}
              onClick={() => { setActiveTab('inactive'); setShowLinkForm(false); setShowInviteAthleteForm(false); setTransferTarget(null); setReactivateError(null); }}
            >
              Inativos ({inactiveLinks.length})
            </button>
          </div>

          {activeTab === 'active' && transferTarget && (
            <div style={styles.linkFormBox}>
              <p style={styles.linkFormTitle}>
                Transferir &ldquo;{transferTarget.athlete?.displayName || transferTarget.athleteId}&rdquo;
              </p>
              <div style={styles.linkFormRow}>
                <select
                  style={styles.select}
                  value={transferTrainerId}
                  onChange={(e) => setTransferTrainerId(e.target.value)}
                  disabled={transferring}
                >
                  <option value="">Novo treinador...</option>
                  {selectableStaff.map((t) => (
                    <option key={t.uid} value={t.uid}>
                      {t.displayName || t.email}
                    </option>
                  ))}
                </select>
                <button style={styles.btnPrimary} onClick={handleTransfer} disabled={transferring}>
                  {transferring ? 'Transferindo…' : 'Transferir'}
                </button>
                <button style={styles.btnSecondary} onClick={() => setTransferTarget(null)}>
                  Cancelar
                </button>
              </div>
              {transferError && <p style={styles.errorText}>{transferError}</p>}
              {selectableStaff.length === 0 && !transferError && (
                <p style={styles.hint}>Nenhum outro treinador disponível nesta conta.</p>
              )}
            </div>
          )}

          {showInviteAthleteForm && (
            <div style={styles.linkFormBox}>
              <p style={styles.linkFormTitle}>Convidar novo atleta</p>
              <div style={styles.linkFormRow}>
                <input
                  style={styles.select}
                  type="email"
                  placeholder="E-mail *"
                  value={inviteAthleteForm.email}
                  onChange={(e) => setInviteAthleteForm((f) => ({ ...f, email: e.target.value }))}
                  disabled={invitingAthlete}
                />
                <input
                  style={styles.select}
                  type="text"
                  placeholder="Nome *"
                  value={inviteAthleteForm.displayName}
                  onChange={(e) => setInviteAthleteForm((f) => ({ ...f, displayName: e.target.value }))}
                  disabled={invitingAthlete}
                />
                <select
                  style={styles.select}
                  value={inviteAthleteForm.trainerId}
                  onChange={(e) => setInviteAthleteForm((f) => ({ ...f, trainerId: e.target.value }))}
                  disabled={invitingAthlete}
                >
                  <option value="">Sem treinador</option>
                  {selectableStaff.map((t) => (
                    <option key={t.uid} value={t.uid}>
                      {t.displayName || t.email}
                    </option>
                  ))}
                </select>
                <button style={styles.btnPrimary} onClick={handleInviteAthlete} disabled={invitingAthlete}>
                  {invitingAthlete ? 'Convidando…' : 'Convidar'}
                </button>
                <button style={styles.btnSecondary} onClick={() => setShowInviteAthleteForm(false)}>
                  Cancelar
                </button>
              </div>
              {inviteAthleteError && <p style={styles.errorText}>{inviteAthleteError}</p>}
            </div>
          )}

          {inviteAthleteSuccess && !showInviteAthleteForm && (
            <p style={styles.successText}>{inviteAthleteSuccess}</p>
          )}

          {activeTab === 'active' && showLinkForm && (
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

          {activeTab === 'active' ? (
            <AthleteLinksTable
              links={links}
              unlinkingId={unlinkingId}
              onDeactivate={handleDeactivate}
              resendingEmail={resendingEmail}
              onResendInvite={handleResendInvite}
              onTransfer={handleOpenTransferForm}
            />
          ) : (
            <>
              {reactivateError && <p style={styles.errorText}>{reactivateError}</p>}
              <AthleteLinksTable
                links={inactiveLinks}
                mode="inactive"
                reactivatingId={reactivatingId}
                onReactivate={handleReactivate}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b' }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: '14px', color: value ? '#0f172a' : '#94a3b8' }}>
        {value || '—'}
      </p>
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
  tabRow: {
    display: 'flex',
    gap: '4px',
  },
  tabActive: {
    padding: '7px 16px',
    borderRadius: '8px',
    border: '1px solid #1d4ed8',
    background: '#1d4ed8',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  tabInactive: {
    padding: '7px 16px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    background: '#fff',
    color: '#374151',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  trainerTableWrapper: {
    overflowX: 'auto',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
  },
  trainerTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
  },
  trainerTh: {
    padding: '10px 14px',
    textAlign: 'left',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#64748b',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
  },
  trainerTr: {
    borderBottom: '1px solid #f1f5f9',
  },
  trainerTd: {
    padding: '12px 14px',
    color: '#0f172a',
    verticalAlign: 'middle',
  },
  btnResend: {
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid #fde68a',
    background: '#fff',
    color: '#92400e',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnDeactivate: {
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid #fecaca',
    background: '#fff',
    color: '#dc2626',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnReactivate: {
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid #bbf7d0',
    background: '#fff',
    color: '#166534',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  infoCard: {
    padding: '16px 20px',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    background: '#fff',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px',
  },
  infoFormGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '12px',
  },
  infoLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '12px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#64748b',
  },
  successText: { color: '#16a34a', fontSize: '14px' },
  hint: { color: '#64748b', fontSize: '14px' },
  errorText: { color: '#dc2626', fontSize: '14px' },
};
