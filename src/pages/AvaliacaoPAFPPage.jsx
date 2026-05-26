import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { useUserDisplayNames } from '../hooks/useUserDisplayNames';
import { useAthleteTrainers } from '../hooks/useAthleteTrainers';
import { useAssessments } from '../hooks/useAssessments';
import { assessmentService } from '../services/assessment.service';
import { getCurrentUserProfile } from '../services/sessionService.js';
import { listTrainerAthleteOptions } from '../services/trainer-athlete-context.service.js';
import {
  mapPafpFormToCreateInput,
  PafpMappingError,
} from './AvaliacaoPAFPPage.mapper';

// Helpers puros
// Normaliza TimestampValue para Date
function toDateSafe(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'object' && val.seconds != null && val.nanoseconds != null) {
    if (typeof val.toDate === 'function') return val.toDate();
    return new Date(val.seconds * 1000);
  }
  return null;
}
function sanitizeFirestoreError(err) {
  const msg = err?.message || String(err);
  const cutIdx = msg.indexOf('You can create it here:');
  return cutIdx !== -1 ? msg.slice(0, cutIdx).trim() : msg;
}
function normalizeRole(profileData) {
  return String(profileData?.papel || '').normalize('NFC').trim().toLowerCase();
}

function formatDate(date) {
  const d = toDateSafe(date);
  if (!d) return '—';
  return d.toLocaleDateString('pt-BR');
}
function timeSince(date) {
  const d = toDateSafe(date);
  if (!d) return '—';
  const now = Date.now();
  const then = d.getTime();
  const diff = now - then;
  if (diff < 0) return '—';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'hoje';
  if (days === 1) return 'há 1 dia';
  return `há ${days} dias`;
}

const initialForm = {
  nome_atleta: '',
  data_avaliacao: new Date().toISOString().split('T')[0],
  tipo_avaliacao: 'inicial',
  avaliador: '',
  saltos: {
    salto_vertical_1: '',
    salto_vertical_2: '',
    salto_vertical_3: '',
    salto_horizontal_1: '',
    salto_horizontal_2: '',
    salto_horizontal_3: '',
    salto_horizontal_4: '',
  },
  estabilidade: {
    oh_squat: 0,
    agachamento_unilateral_d: 0,
    agachamento_unilateral_e: 0,
    anjo_parede_d: 0,
    anjo_parede_e: 0,
    centro_pia: 0,
  },
  resistencia_cardio: {
    flexoes_1min: '',
    nivel_execucao_flexao: 'iniciante',
    abdominal_remador_1min: '',
    yoyo_nivel: '',
  },
  observacoes: '',
};

const avaliacaoTypes = ['inicial', '60d', '90d'];
const nivelFlexaoOptions = ['iniciante', 'intermediario', 'avancado'];
const estabilidadeOptions = [0, 1, 2, 3, 4, 5];

export default function AvaliacaoPAFPPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Role detection
  const [role, setRole] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  // Trainer-only: athlete selection
  const [athleteOptions, setAthleteOptions] = useState([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState(null);

  useEffect(() => {
    if (!user?.uid) { setLoadingProfile(false); return; }
    async function loadProfile() {
      try {
        const profileData = await getCurrentUserProfile(user.uid);
        const r = normalizeRole(profileData);
        setRole(r);
        if (r === 'treinador' || r === 'coach') {
          const options = await listTrainerAthleteOptions(user.uid);
          setAthleteOptions(Array.isArray(options) ? options : []);
        }
      } catch {
        // on error, default to athlete role (safe fallback)
      } finally {
        setLoadingProfile(false);
      }
    }
    loadProfile();
  }, [user?.uid]);

  const isTrainer = role === 'treinador' || role === 'coach';

  // Derived UIDs — null while profile is loading to avoid spurious Firestore reads
  const assessmentAthleteId = loadingProfile ? null : (isTrainer ? selectedAthleteId : (user?.uid || null));
  // For trainer: pass their own UID so the query includes trainerUserId filter,
  // which is required for Firestore to authorize the collection query against the security rules.
  const assessmentTrainerUid = loadingProfile ? null : (isTrainer ? (user?.uid || null) : null);
  const trainerHookUid = loadingProfile ? null : (isTrainer ? null : (user?.uid || null));

  // Histórico de avaliações
  const {
    assessments: assessmentsRaw,
    loading: loadingAssessments,
    error: errorAssessments,
  } = useAssessments({ athleteUserId: assessmentAthleteId, trainerUserId: assessmentTrainerUid });
  const assessments = Array.isArray(assessmentsRaw) ? assessmentsRaw : [];
  const sortedAssessments = useMemo(() => {
    return [...assessments].filter(a => a && a.activityDate).sort((a, b) => {
      const da = new Date(a.activityDate).getTime();
      const db = new Date(b.activityDate).getTime();
      return db - da;
    });
  }, [assessments]);
  const lastAssessment = sortedAssessments.length > 0 ? sortedAssessments[0] : null;

  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const userDisplayNames = useUserDisplayNames([user?.uid]);

  const totalSteps = 5;
  const progressLabel = `ETAPA ${step} DE ${totalSteps}`;

  // Trainer options — only fetched for athlete role (trainer IS the evaluator)
  const trainerOptionsState = useAthleteTrainers(trainerHookUid);
  const trainerOptions = useMemo(
    () => (Array.isArray(trainerOptionsState.trainers) ? trainerOptionsState.trainers : [])
      .map((t) => ({ trainerUserId: t.id, displayName: t.displayName || t.id, isPrimary: false })),
    [trainerOptionsState.trainers],
  );
  const trainerOptionsLoading = trainerOptionsState.loading;
  const trainerOptionsError = trainerOptionsState.error;
  const trainerOptionIds = useMemo(
    () => trainerOptions.map((option) => option.trainerUserId),
    [trainerOptions],
  );

  // nome_atleta: athlete path uses own display name
  useEffect(() => {
    if (isTrainer) return;
    const publicDisplayName = user?.uid ? (userDisplayNames[user.uid] || '') : '';
    setForm((prev) => ({ ...prev, nome_atleta: publicDisplayName }));
  }, [user?.uid, userDisplayNames, isTrainer]);

  // nome_atleta: trainer path uses selected athlete's display name
  useEffect(() => {
    if (!isTrainer) return;
    const athlete = athleteOptions.find((a) => a.id === selectedAthleteId);
    setForm((prev) => ({ ...prev, nome_atleta: athlete?.displayName || '' }));
  }, [isTrainer, selectedAthleteId, athleteOptions]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        navigate('/dashboard');
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [success, navigate]);

  const bestVertical = useMemo(() => {
    const values = [
      Number(form.saltos.salto_vertical_1),
      Number(form.saltos.salto_vertical_2),
      Number(form.saltos.salto_vertical_3),
    ];
    return Math.max(...values.map((value) => (Number.isFinite(value) ? value : 0)));
  }, [form.saltos]);

  const bestHorizontal = useMemo(() => {
    const values = [
      Number(form.saltos.salto_horizontal_1),
      Number(form.saltos.salto_horizontal_2),
      Number(form.saltos.salto_horizontal_3),
      Number(form.saltos.salto_horizontal_4),
    ];
    return Math.max(...values.map((value) => (Number.isFinite(value) ? value : 0)));
  }, [form.saltos]);

  const stabilityTotal = useMemo(
    () => Object.values(form.estabilidade).reduce((sum, value) => sum + Number(value), 0),
    [form.estabilidade],
  );

  const stabilityAverage = useMemo(
    () => Math.round((stabilityTotal / Object.keys(form.estabilidade).length) * 10) / 10,
    [stabilityTotal],
  );

  const saltosSummary = useMemo(() => {
    const verticals = [form.saltos.salto_vertical_1, form.saltos.salto_vertical_2, form.saltos.salto_vertical_3].filter(v => v);
    const horizontals = [form.saltos.salto_horizontal_1, form.saltos.salto_horizontal_2, form.saltos.salto_horizontal_3, form.saltos.salto_horizontal_4].filter(v => v);
    return `Saltos verticais: ${verticals.length} registrados. Saltos horizontais: ${horizontals.length} registrados.`;
  }, [form.saltos]);

  const estabilidadeSummary = useMemo(() => {
    const scores = Object.values(form.estabilidade);
    const totalItems = scores.length;
    const completedItems = scores.filter(s => s > 0).length;
    return `Itens de estabilidade avaliados: ${completedItems}/${totalItems}.`;
  }, [form.estabilidade]);

  const resistenciaSummary = useMemo(() => {
    const { flexoes_1min, nivel_execucao_flexao, abdominal_remador_1min, yoyo_nivel } = form.resistencia_cardio;
    return `Flexões: ${flexoes_1min || 'não informado'}, Nível: ${nivel_execucao_flexao}, Abdominais: ${abdominal_remador_1min || 'não informado'}, Yo-Yo: ${yoyo_nivel || 'não informado'}.`;
  }, [form.resistencia_cardio]);

  const validateStep = () => {
    if (step === 1) {
      if (isTrainer) {
        if (!selectedAthleteId) return 'Selecione o atleta a ser avaliado.';
      } else {
        if (!form.nome_atleta.trim()) return 'Nome do atleta não pôde ser carregado.';
        if (!form.avaliador || !trainerOptionIds.includes(form.avaliador)) {
          return 'Selecione um treinador vinculado.';
        }
      }
      if (!form.data_avaliacao) return 'Informe a data da avaliação.';
      if (!avaliacaoTypes.includes(form.tipo_avaliacao)) return 'Selecione o tipo de avaliação.';
    }

    if (step === 2) {
      const values = Object.values(form.estabilidade);
      if (values.some((value) => !Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 5)) {
        return 'Avalie todos os itens de estabilidade entre 0 e 5.';
      }
    }

    if (step === 3) {
      const values = Object.values(form.saltos);
      if (values.some((value) => !/^[0-9]+(\.|,)?[0-9]*$/.test(String(value).replace(',', '.').trim()))) {
        return 'Informe todos os saltos com números válidos.';
      }
    }

    if (step === 4) {
      if (!/^[0-9]+$/.test(String(form.resistencia_cardio.flexoes_1min))) {
        return 'Informe o número de flexões em 1 minuto.';
      }
      if (!nivelFlexaoOptions.includes(form.resistencia_cardio.nivel_execucao_flexao)) {
        return 'Selecione o nível de execução de flexão.';
      }
      if (!/^[0-9]+$/.test(String(form.resistencia_cardio.abdominal_remador_1min))) {
        return 'Informe o número de abdominais remador em 1 minuto.';
      }
      if (!form.resistencia_cardio.yoyo_nivel.trim()) {
        return 'Informe o nível do yoyo.';
      }
    }

    return '';
  };

  const handleNext = () => {
    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setStep((current) => Math.min(totalSteps, current + 1));
  };

  const handlePrevious = () => {
    setError('');
    setStep((current) => Math.max(1, current - 1));
  };

  const handleSubmit = async () => {
    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setLoading(true);

    try {
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      let athleteUid, trainerUid;
      if (isTrainer) {
        if (!selectedAthleteId) throw new Error('Selecione o atleta a ser avaliado.');
        athleteUid = selectedAthleteId;
        trainerUid = user.uid;
      } else {
        const trainerUserId = form.avaliador;
        if (!trainerUserId || !trainerOptionIds.includes(trainerUserId)) {
          throw new Error('Selecione um treinador vinculado.');
        }
        athleteUid = user.uid;
        trainerUid = trainerUserId;
      }

      const input = mapPafpFormToCreateInput(form, {
        athleteUid,
        trainerUid,
        academyId: null,
      });

      await assessmentService.createAssessment(input, user.uid);
      setSuccess(true);
    } catch (err) {
      if (err instanceof PafpMappingError) {
        setError(err.message);
      } else {
        setError(err?.message || 'Erro ao salvar avaliação.');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            {isTrainer ? (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <label style={{ fontWeight: 600, color: '#263238' }}>Atleta</label>
                <select
                  value={selectedAthleteId || ''}
                  onChange={(e) => setSelectedAthleteId(e.target.value || null)}
                  disabled={athleteOptions.length === 0}
                  style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid #cfd8dc', fontSize: '1rem' }}
                >
                  <option value="">
                    {athleteOptions.length === 0 ? 'Nenhum atleta vinculado' : 'Selecione o atleta'}
                  </option>
                  {athleteOptions.map((a) => (
                    <option key={a.id} value={a.id}>{a.displayName}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <label style={{ fontWeight: 600, color: '#263238' }}>Nome do atleta</label>
                <input
                  type="text"
                  value={form.nome_atleta}
                  readOnly
                  style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid #cfd8dc', fontSize: '1rem', backgroundColor: '#f5f5f5', color: '#666' }}
                />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <label style={{ fontWeight: 600, color: '#263238' }}>Data da avaliação</label>
                <input
                  type="date"
                  value={form.data_avaliacao}
                  onChange={(event) => setForm((prev) => ({ ...prev, data_avaliacao: event.target.value }))}
                  style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid #cfd8dc', fontSize: '1rem' }}
                />
              </div>

              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <label style={{ fontWeight: 600, color: '#263238' }}>Tipo de avaliação</label>
                <select
                  value={form.tipo_avaliacao}
                  onChange={(event) => setForm((prev) => ({ ...prev, tipo_avaliacao: event.target.value }))}
                  style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid #cfd8dc', fontSize: '1rem' }}
                >
                  {avaliacaoTypes.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>

            {!isTrainer && (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <label style={{ fontWeight: 600, color: '#263238' }}>Treinador</label>
                <select
                  value={form.avaliador}
                  onChange={(event) => setForm((prev) => ({ ...prev, avaliador: event.target.value }))}
                  disabled={trainerOptionsLoading || trainerOptions.length === 0}
                  style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid #cfd8dc', fontSize: '1rem' }}
                >
                  <option value="">
                    {trainerOptionsLoading
                      ? 'Carregando treinadores...'
                      : trainerOptions.length === 0
                        ? 'Nenhum treinador vinculado'
                        : 'Selecione o treinador'}
                  </option>
                  {trainerOptions.map((option) => (
                    <option key={option.trainerUserId} value={option.trainerUserId}>
                      {option.displayName}{option.isPrimary ? ' (primary)' : ''}
                    </option>
                  ))}
                </select>
                {trainerOptionsError ? (
                  <span style={{ color: '#c62828', fontSize: '0.85rem' }}>
                    Falha ao carregar treinadores: {trainerOptionsError.message}
                  </span>
                ) : null}
              </div>
            )}
          </div>
        );
      case 2:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
            <p style={{ margin: 0, color: '#546e7a', textAlign: 'center' }}>Avalie a estabilidade com notas de 0 a 5.</p>
            <div style={{ display: 'grid', gap: '1rem', width: '100%', maxWidth: '520px' }}>
              {Object.entries(form.estabilidade).map(([key, value]) => (
                <div key={key} style={{ display: 'grid', gap: '0.75rem', alignItems: 'center', justifyItems: 'center' }}>
                  <label style={{ fontWeight: 600, color: '#263238', textTransform: 'capitalize', textAlign: 'center' }}>{key.replace(/_/g, ' ')}</label>
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {estabilidadeOptions.map((score) => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => setForm((prev) => ({
                          ...prev,
                          estabilidade: { ...prev.estabilidade, [key]: score },
                        }))}
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '10px',
                          border: value === score ? '2px solid #1565c0' : '1px solid #cfd8dc',
                          background: value === score ? '#1565c0' : '#fff',
                          color: value === score ? '#fff' : '#37474f',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 3:
        return (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            <p style={{ margin: 0, color: '#546e7a' }}>Registre os saltos verticais e horizontais em centímetros.</p>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {[
                ['Salto vertical 1', 'salto_vertical_1'],
                ['Salto vertical 2', 'salto_vertical_2'],
                ['Salto vertical 3', 'salto_vertical_3'],
                ['Salto horizontal 1', 'salto_horizontal_1'],
                ['Salto horizontal 2', 'salto_horizontal_2'],
                ['Salto horizontal 3', 'salto_horizontal_3'],
                ['Salto horizontal 4', 'salto_horizontal_4'],
              ].map(([label, key]) => (
                <div key={key} style={{ display: 'grid', gap: '0.75rem' }}>
                  <label style={{ fontWeight: 600, color: '#263238' }}>{label}</label>
                  <input
                    type="text"
                    value={form.saltos[key]}
                    onChange={(event) => {
                      const value = event.target.value.replace(/[^0-9.,]/g, '');
                      setForm((prev) => ({
                        ...prev,
                        saltos: { ...prev.saltos, [key]: value },
                      }));
                    }}
                    placeholder="cm"
                    style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid #cfd8dc', fontSize: '1rem' }}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      case 4:
        return (
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            <p style={{ margin: 0, color: '#546e7a' }}>Complete a resistência muscular periférica e cardiorrespiratória.</p>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <label style={{ fontWeight: 600, color: '#263238' }}>Flexões em 1 minuto</label>
              <input
                type="text"
                value={form.resistencia_cardio.flexoes_1min}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, '');
                  setForm((prev) => ({
                    ...prev,
                    resistencia_cardio: { ...prev.resistencia_cardio, flexoes_1min: digits },
                  }));
                }}
                style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid #cfd8dc', fontSize: '1rem' }}
              />
            </div>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <label style={{ fontWeight: 600, color: '#263238' }}>Nível de execução de flexão</label>
              <select
                value={form.resistencia_cardio.nivel_execucao_flexao}
                onChange={(event) => setForm((prev) => ({
                  ...prev,
                  resistencia_cardio: { ...prev.resistencia_cardio, nivel_execucao_flexao: event.target.value },
                }))}
                style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid #cfd8dc', fontSize: '1rem' }}
              >
                {nivelFlexaoOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <label style={{ fontWeight: 600, color: '#263238' }}>Abdominal remador em 1 minuto</label>
              <input
                type="text"
                value={form.resistencia_cardio.abdominal_remador_1min}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, '');
                  setForm((prev) => ({
                    ...prev,
                    resistencia_cardio: { ...prev.resistencia_cardio, abdominal_remador_1min: digits },
                  }));
                }}
                style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid #cfd8dc', fontSize: '1rem' }}
              />
            </div>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <label style={{ fontWeight: 600, color: '#263238' }}>Nível do yoyo</label>
              <input
                type="text"
                value={form.resistencia_cardio.yoyo_nivel}
                onChange={(event) => setForm((prev) => ({
                  ...prev,
                  resistencia_cardio: { ...prev.resistencia_cardio, yoyo_nivel: event.target.value },
                }))}
                style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid #cfd8dc', fontSize: '1rem' }}
              />
            </div>
          </div>
        );
      case 5:
        return (
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            <p style={{ margin: 0, color: '#546e7a' }}>Registre observações adicionais da avaliação.</p>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <label style={{ fontWeight: 600, color: '#263238' }}>Observações</label>
              <textarea
                value={form.observacoes}
                onChange={(event) => setForm((prev) => ({ ...prev, observacoes: event.target.value }))}
                rows={6}
                style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid #cfd8dc', fontSize: '1rem', resize: 'vertical' }}
              />
            </div>
            <div style={{ background: '#f1f5f9', borderRadius: '10px', padding: '1rem', border: '1px solid #d1d5db' }}>
              <p style={{ margin: 0, fontWeight: 600, color: '#102a43' }}>Resumo da avaliação</p>
              <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
                <div>
                  <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: '#334e68' }}>Resumo Técnico</p>
                  <p style={{ margin: '0.25rem 0 0 0', color: '#334e68' }}>Melhor salto vertical: {bestVertical} cm</p>
                  <p style={{ margin: '0.25rem 0 0 0', color: '#334e68' }}>Melhor salto horizontal: {bestHorizontal} cm</p>
                  <p style={{ margin: '0.25rem 0 0 0', color: '#334e68' }}>Score estabilidade total: {stabilityTotal}</p>
                  <p style={{ margin: '0.25rem 0 0 0', color: '#334e68' }}>Score estabilidade média: {stabilityAverage}</p>
                </div>
                <div>
                  <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: '#334e68' }}>Conferência dos Blocos</p>
                  <p style={{ margin: '0.25rem 0 0 0', color: '#334e68' }}>Saltos: {saltosSummary}</p>
                  <p style={{ margin: '0.25rem 0 0 0', color: '#334e68' }}>Estabilidade: {estabilidadeSummary}</p>
                  <p style={{ margin: '0.25rem 0 0 0', color: '#334e68' }}>Resistência/Cardio: {resistenciaSummary}</p>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (loadingProfile) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#546e7a', fontSize: '1rem' }}>Carregando...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        <header style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h1 style={{ fontSize: '2.5rem', color: '#1a237e', margin: 0, fontWeight: 700 }}>Avaliação Física PAFP</h1>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', background: '#fff', padding: '0.65rem 1rem', borderRadius: '24px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)', margin: '1rem 0' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1976d2', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{progressLabel}</span>
          </div>
          <p style={{ margin: '0', fontSize: '1.05rem', color: '#546e7a', maxWidth: '560px', margin: '0 auto' }}>Registre a avaliação física do atleta em etapas para garantir dados consistentes e prontos para o Firestore.</p>
        </header>

        <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 12px 40px rgba(0,0,0,0.08)', padding: '2rem', border: '1px solid #e2e8f0' }}>
          {/* Bloco de avaliações anteriores */}
          <section style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.35rem', color: '#1a237e', margin: '0 0 0.5rem 0', fontWeight: 700 }}>Histórico de Avaliações</h2>
            {loadingAssessments ? (
              <p style={{ color: '#1976d2', margin: 0 }}>Carregando avaliações...</p>
            ) : errorAssessments ? (
              <p style={{ color: '#c62828', margin: 0 }}>Erro ao carregar avaliações: {sanitizeFirestoreError(errorAssessments)}</p>
            ) : sortedAssessments.length === 0 ? (
              <p style={{ color: '#546e7a', margin: 0 }}>Nenhuma avaliação registrada até o momento.</p>
            ) : (
              <>
                <div style={{ marginBottom: '1rem', color: '#263238', fontWeight: 500 }}>
                  Última avaliação: {formatDate(lastAssessment.activityDate)} ({timeSince(lastAssessment.activityDate)})
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {sortedAssessments.map((a, idx) => (
                    <li key={a.id || idx} style={{
                      background: '#f5f7fa',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      marginBottom: '0.75rem',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                    }}>
                      <div style={{ fontWeight: 600, color: '#1976d2' }}>
                        {formatDate(a.activityDate)} ({timeSince(a.activityDate)})
                      </div>
                      <div style={{ color: '#263238', fontSize: '1rem' }}>
                        Tipo: {a.formData?.tipo_avaliacao || '-'}
                      </div>
                      <div style={{ color: '#546e7a', fontSize: '0.95rem' }}>
                        Observações: {a.formData?.observacoes || '-'}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
          {success ? (
            <div style={{ textAlign: 'center', padding: '2rem', borderRadius: '14px', background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)', border: '1px solid #4caf50' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
              <h2 style={{ margin: '0 0 1rem 0', color: '#2e7d32', fontSize: '1.6rem' }}>Avaliação PAFP registrada</h2>
              <p style={{ margin: 0, color: '#2e7d32', fontSize: '1rem' }}>Os dados foram salvos na coleção <strong>assessments</strong>.</p>
            </div>
          ) : (
            <>
              <div style={{ minHeight: '260px', marginBottom: '1.75rem' }}>
                {renderStepContent()}
              </div>

              {error && (
                <div style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem', background: '#ffebee', border: '1px solid #ef5350', borderRadius: '12px', color: '#c62828', fontWeight: 600 }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={step === 1 || loading}
                  style={{ flex: 1, padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#fff', color: '#374151', cursor: step === 1 || loading ? 'not-allowed' : 'pointer', fontWeight: 700, boxShadow: '0 4px 10px rgba(15,23,42,0.06)' }}
                >
                  ← Anterior
                </button>
                {step === totalSteps ? (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    style={{ flex: 1, padding: '1rem 1.25rem', borderRadius: '12px', border: 'none', background: loading ? '#9e9e9e' : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)', color: '#fff', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 6px 18px rgba(25,118,210,0.28)' }}
                  >
                    {loading ? 'Salvando...' : 'Salvar Avaliação'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={loading}
                    style={{ flex: 1, padding: '1rem 1.25rem', borderRadius: '12px', border: 'none', background: loading ? '#9e9e9e' : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)', color: '#fff', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 6px 18px rgba(25,118,210,0.28)' }}
                  >
                    Próximo →
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
