// src/index.js

import { makeWASocket, fetchLatestBaileysVersion, DisconnectReason } from '@whiskeysockets/baileys';
import utils from './utils/utils.js';
import fs from 'fs';
import dotenv from 'dotenv';
import MySQLAuthState from './utils/MySQLAuth.js';

dotenv.config();

async function startWhatsAppSocket() {
    try {
        const dbConfig = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        };

        const authState = new MySQLAuthState(dbConfig);
        await authState.init();

        // Verifique se o estado de autenticação é válido
        if (!authState.stateData || !authState.stateData.creds) {
            console.error('Estado de autenticação inválido. Iniciando um novo.');
            authState.stateData = { creds: {}, keys: {} };
        }

        const { state, saveCreds } = {
            state: authState.stateData,
            saveCreds: async () => {
                await authState.saveState();
            }
        };

        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            printQRInTerminal: true,
            auth: state,
            version,
        });

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                if (lastDisconnect && lastDisconnect.error) {
                    const boomError = lastDisconnect.error;
                    const shouldReconnect = boomError.output ? boomError.output.statusCode !== DisconnectReason.loggedOut : true;
                    console.log('Connection closed due to', boomError, ', reconnecting:', shouldReconnect);
                    if (shouldReconnect) {
                        startWhatsAppSocket();
                    } else {
                        console.log('Desconectado permanentemente');
                    }
                }
            } else if (connection === 'open') {
                console.log('Conexão aberta com sucesso');
            }
        });

        sock.ev.on('messages.upsert', async ({ messages }) => {
            const message = messages[0];
            if (message.message) { // Verifica se a mensagem existe
                console.log(JSON.stringify(message, undefined, 2));
                if (!message.key.fromMe) {
                    console.log('Respondendo para', message.key.remoteJid);
                    await utils.handleMessage(sock, message);
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);

        // Cria as pastas necessárias se não existirem
        const folders = ['audio', 'video', 'images'];
        for (const folder of folders) {
            if (!fs.existsSync(folder)) {
                fs.mkdirSync(folder);
            }
        }
    } catch (error) {
        console.error('Falha ao iniciar o socket do WhatsApp:', error);
    }
}

startWhatsAppSocket();
