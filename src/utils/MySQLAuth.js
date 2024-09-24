// src/utils/MySQLAuth.js
import mysql from 'mysql2/promise';

class MySQLAuthState {
  constructor(dbConfig) {
    this.dbConfig = dbConfig;
    this.state = null; // Inicializa o estado como null
  }

  async init() {
    try {
      this.connection = await mysql.createConnection(this.dbConfig);

      // Cria a tabela 'auth' se não existir
      await this.connection.execute(`
        CREATE TABLE IF NOT EXISTS auth (
          id INT PRIMARY KEY AUTO_INCREMENT,
          state JSON
        )
      `);

      // Recupera o estado salvo se existir
      const [rows] = await this.connection.execute(`SELECT state FROM auth WHERE id = 1`);
      if (rows.length > 0 && rows[0].state) {
        try {
          // Verifica se o estado já é um objeto ou uma string
          this.state = typeof rows[0].state === 'string' ? JSON.parse(rows[0].state) : rows[0].state;
        } catch (error) {
          console.error('Erro ao analisar o estado JSON:', error);
          this.state = { creds: {}, keys: {} }; // Define um estado padrão em caso de erro
        }
      } else {
        // Insere um estado inicial vazio
        this.state = { creds: {}, keys: {} }; // Define um estado padrão
        await this.connection.execute(`INSERT INTO auth (id, state) VALUES (1, ?)`, [JSON.stringify(this.state)]);
      }
    } catch (error) {
      console.error('Erro ao inicializar a conexão com o banco de dados:', error);
      throw error; // Propaga o erro para ser tratado no index.js
    }
  }

  get stateData() {
    return this.state;
  }

  async saveState() {
    try {
      await this.connection.execute('UPDATE auth SET state = ? WHERE id = 1', [JSON.stringify(this.state)]);
    } catch (error) {
      console.error('Erro ao salvar o estado no banco de dados:', error);
      throw error; // Propaga o erro para ser tratado no index.js
    }
  }

  async close() {
    await this.connection.end();
  }
}

export default MySQLAuthState;
