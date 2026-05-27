import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createUser, getUserProfile, listTrainers, updateUserProfile } from '../../services/userService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { UserForm } from '../../components/users/UserForm.jsx';

export default function AdminUserFormPage() {
  const { userId } = useParams();
  const isEdit = Boolean(userId);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [initialValues, setInitialValues] = useState(null);
  const [trainers, setTrainers] = useState([]);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [profile, trainerList] = await Promise.all([
          isEdit ? getUserProfile(userId) : Promise.resolve(null),
          listTrainers(),
        ]);
        if (isEdit && !profile) {
          setError('Usuário não encontrado.');
          return;
        }
        if (profile) setInitialValues(profile);
        setTrainers(trainerList);
      } catch (err) {
        setError('Erro ao carregar dados: ' + err.message);
      } finally {
        setLoadingData(false);
      }
    }
    load();
  }, [userId, isEdit]);

  async function handleSubmit(formData) {
    setSubmitting(true);
    setError(null);
    try {
      if (isEdit) {
        await updateUserProfile(userId, formData, user.uid);
      } else {
        await createUser(formData, user.uid);
      }
      navigate('/admin/users');
    } catch (err) {
      setError(err.message || 'Erro ao salvar usuário.');
      setSubmitting(false);
    }
  }

  if (loadingData) {
    return <div style={styles.page}><p style={styles.hint}>Carregando...</p></div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <p style={styles.eyebrow}>Administração / Usuários</p>
        <h1 style={styles.title}>{isEdit ? 'Editar usuário' : 'Novo usuário'}</h1>
        {isEdit && (
          <p style={styles.subtitle}>
            Email não pode ser alterado aqui. Para redefinir a senha, use a opção de recuperação de senha.
          </p>
        )}
      </div>

      {error && <p style={styles.errorText}>{error}</p>}

      <div style={styles.formCard}>
        <UserForm
          initialValues={initialValues || {}}
          mode={isEdit ? 'edit' : 'create'}
          trainers={trainers}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/admin/users')}
          loading={submitting}
        />
      </div>
    </div>
  );
}

const styles = {
  page: { display: 'grid', gap: '20px', padding: '24px', maxWidth: '600px', margin: '0 auto' },
  header: { display: 'grid', gap: '4px' },
  eyebrow: { margin: 0, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#475569' },
  title: { margin: 0, fontSize: '22px', fontWeight: 700, color: '#0f172a' },
  subtitle: { margin: 0, fontSize: '12px', color: '#64748b' },
  hint: { color: '#64748b', fontSize: '14px' },
  errorText: { color: '#dc2626', fontSize: '14px' },
  formCard: {
    background: '#fff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
};
