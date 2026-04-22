/**
 * Modelo de usuário - Define a estrutura de dados de um usuário
 */

export class User {
  constructor(id, email, nome, perfil = 'user') {
    this.id = id;
    this.email = email;
    this.nome = nome;
    this.perfil = perfil; // 'user', 'admin', 'avaliador'
    this.dataCriacao = new Date();
  }

  // Método auxiliar para criar User a partir de dados do Firebase
  static fromFirebase(doc) {
    return new User(
      doc.uid || doc.id,
      doc.email,
      doc.nome,
      doc.perfil || 'user'
    );
  }

  // Converter para objeto simples para enviar ao Firebase
  toJSON() {
    return {
      id: this.id,
      email: this.email,
      nome: this.nome,
      perfil: this.perfil,
      dataCriacao: this.dataCriacao,
    };
  }
}

export default User;
