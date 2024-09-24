// src/utils/MySQLAuth.js

import mysql from 'mysql2/promise';

class MySQLAuthState {
    constructor(dbConfig) {
        this.dbConfig = dbConfig;
        this.state = {
            creds: {},
            keys: {}
        };
    }

    async init() {
        this.connection = await mysql.createConnection(this.dbConfig);
        // Cria a tabela auth se não existir
        await this.connection.execute(`
            CREATE TABLE IF NOT EXISTS auth (
                id INT PRIMARY KEY,
                state JSON
            )
        `);
        // Recupera o estado salvo se existir
        const [rows] = await this.connection.execute(`SELECT state FROM auth WHERE id = 1`);
        if (rows.length > 0 && rows[0].state) {
            try {
                this.state = JSON.parse(rows[0].state);
            } catch (error) {
                console.error('Erro ao analisar o estado JSON:', error);
                // Se houver erro, inicializa o estado padrão
                this.state = { creds: {}, keys: {} };
            }
        } else {
            // Insere um estado inicial vazio
            await this.connection.execute(`INSERT INTO auth (id, state) VALUES (1, ?)`, [JSON.stringify(this.state)]);
        }
    }

    get stateData() {
        return this.state;
    }

    async saveState() {
        await this.connection.execute(`UPDATE auth SET state = ? WHERE id = 1`, [JSON.stringify(this.state)]);
    }

    async close() {
        await this.connection.end();
    }
}

export default MySQLAuthState;
