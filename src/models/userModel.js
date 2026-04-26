/**
 * Modelo de usuário - Define a estrutura de dados de um usuário
 */

export class User {
  constructor(
    id,
    email,
    nome,
    papel = 'atleta',
    coach_id = null,
    treinador_id = null,
    coach_nome = null,
    coach_email = null,
    treinador_nome = null,
    treinador_email = null
  ) {
    this.id = id;
    this.email = email;
    this.nome = nome;
    this.papel = papel;
    this.coach_id = coach_id;
    this.treinador_id = treinador_id;
    this.coach_nome = coach_nome;
    this.coach_email = coach_email;
    this.treinador_nome = treinador_nome;
    this.treinador_email = treinador_email;
  }

  // Método auxiliar para criar User a partir de dados do Firebase
  static fromFirebase(doc) {
    return new User(
      doc.uid || doc.id,
      doc.email,
      doc.nome,
      doc.papel || 'atleta',
      doc.coach_id || null,
      doc.treinador_id || null,
      doc.coach_nome || null,
      doc.coach_email || null,
      doc.treinador_nome || null,
      doc.treinador_email || null
    );
  }

  // Converter para objeto simples para enviar ao Firebase
  toJSON() {
    return {
      email: this.email,
      nome: this.nome,
      papel: this.papel,
      coach_id: this.coach_id,
      treinador_id: this.treinador_id,
      coach_nome: this.coach_nome,
      coach_email: this.coach_email,
      treinador_nome: this.treinador_nome,
      treinador_email: this.treinador_email,
    };
  }
}

export default User;
