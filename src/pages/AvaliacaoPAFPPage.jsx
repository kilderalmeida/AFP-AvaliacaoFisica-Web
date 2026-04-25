import { useMemo, useState, useEffect } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext.jsx';
import { db } from '../services/firebase/config.js';
import { getCurrentUserProfile } from '../services/sessionService.js';

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
const avaliadorOptions = ['Saulo Souza', 'Gustavo Sales']; // TODO: Fetch from users with perfil 'avaliador'

export default function AvaliacaoPAFPPage() {
  const { user } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  const totalSteps = 5;
  const progressLabel = `ETAPA ${step} DE ${totalSteps}`;

  useEffect(() => {
    if (user?.uid) {
      getCurrentUserProfile(user.uid).then((profile) => {
        setUserProfile(profile);
        if (profile?.nome) {
          setForm((prev) => ({ ...prev, nome_atleta: profile.nome }));
        }
      });
    }
  }, [user]);

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
      if (!form.nome_atleta.trim()) return 'Nome do atleta não pôde ser carregado.';
      if (!form.data_avaliacao) return 'Informe a data da avaliação.';
      if (!avaliacaoTypes.includes(form.tipo_avaliacao)) return 'Selecione o tipo de avaliação.';
      if (!avaliadorOptions.includes(form.avaliador)) return 'Selecione um avaliador válido.';
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

  const buildPayload = () => ({
    nome_atleta: form.nome_atleta.trim(),
    data_avaliacao: form.data_avaliacao ? new Date(form.data_avaliacao) : null,
    tipo_avaliacao: form.tipo_avaliacao,
    avaliador: form.avaliador.trim(),
    saltos: {
      salto_vertical_1: Number(form.saltos.salto_vertical_1),
      salto_vertical_2: Number(form.saltos.salto_vertical_2),
      salto_vertical_3: Number(form.saltos.salto_vertical_3),
      salto_horizontal_1: Number(form.saltos.salto_horizontal_1),
      salto_horizontal_2: Number(form.saltos.salto_horizontal_2),
      salto_horizontal_3: Number(form.saltos.salto_horizontal_3),
      salto_horizontal_4: Number(form.saltos.salto_horizontal_4),
    },
    estabilidade: {
      oh_squat: Number(form.estabilidade.oh_squat),
      agachamento_unilateral_d: Number(form.estabilidade.agachamento_unilateral_d),
      agachamento_unilateral_e: Number(form.estabilidade.agachamento_unilateral_e),
      anjo_parede_d: Number(form.estabilidade.anjo_parede_d),
      anjo_parede_e: Number(form.estabilidade.anjo_parede_e),
      centro_pia: Number(form.estabilidade.centro_pia),
    },
    resistencia_cardio: {
      flexoes_1min: Number(form.resistencia_cardio.flexoes_1min),
      nivel_execucao_flexao: form.resistencia_cardio.nivel_execucao_flexao,
      abdominal_remador_1min: Number(form.resistencia_cardio.abdominal_remador_1min),
      yoyo_nivel: form.resistencia_cardio.yoyo_nivel.trim(),
    },
    observacoes: form.observacoes.trim(),
    melhor_salto_vertical: bestVertical,
    melhor_salto_horizontal: bestHorizontal,
    score_estabilidade_total: stabilityTotal,
    score_estabilidade_media: stabilityAverage,
    status_avaliacao: 'finalizada',
    createdAt: serverTimestamp(),
    athletaId: user?.uid || null,
  });

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

      const payload = buildPayload();
      await addDoc(collection(db, 'avaliacoes_pafp'), payload);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Erro ao salvar avaliação.');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <label style={{ fontWeight: 600, color: '#263238' }}>Nome do atleta</label>
              <input
                type="text"
                value={form.nome_atleta}
                readOnly
                style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid #cfd8dc', fontSize: '1rem', backgroundColor: '#f5f5f5', color: '#666' }}
              />
            </div>

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

            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <label style={{ fontWeight: 600, color: '#263238' }}>Avaliador</label>
              <select
                value={form.avaliador}
                onChange={(event) => setForm((prev) => ({ ...prev, avaliador: event.target.value }))}
                style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid #cfd8dc', fontSize: '1rem' }}
              >
                <option value="">Selecione o avaliador</option>
                {avaliadorOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
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
          {success ? (
            <div style={{ textAlign: 'center', padding: '2rem', borderRadius: '14px', background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)', border: '1px solid #4caf50' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
              <h2 style={{ margin: '0 0 1rem 0', color: '#2e7d32', fontSize: '1.6rem' }}>Avaliação PAFP registrada</h2>
              <p style={{ margin: 0, color: '#2e7d32', fontSize: '1rem' }}>Os dados foram salvos na coleção <strong>avaliacoes_pafp</strong>.</p>
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
