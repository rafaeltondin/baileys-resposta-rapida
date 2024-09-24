// src/index.js
import { makeWASocket, fetchLatestBaileysVersion, DisconnectReason } from '@whiskeysockets/baileys';
import utils from './utils/utils.js';
import fs from 'fs';
import dotenv from 'dotenv';
import MySQLAuthState from './utils/MySQLAuth.js';

dotenv.config();

async function startWhatsAppSocket() {
  const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };

  // Inicializa o gerenciador de estado de autenticação MySQL
  const authState = new MySQLAuthState(dbConfig);
  await authState.init();

  // Obtém o estado e a função para salvar credenciais
  const { stateData, saveState } = authState;
  const state = stateData;

  // Define a função para salvar credenciais
  const saveCreds = async () => {
    await authState.saveState();
  };

  try {
    // Obtém a versão mais recente do Baileys
    const { version } = await fetchLatestBaileysVersion();

    // Cria o socket do WhatsApp
    const sock = makeWASocket({
      printQRInTerminal: true,
      auth: state, // Passa o estado diretamente
      version,
    });

    // Listener para eventos de atualização de conexão
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'close') {
        if (lastDisconnect && lastDisconnect.error) {
          const boomError = lastDisconnect.error;
          const shouldReconnect =
            boomError.output ? boomError.output.statusCode !== DisconnectReason.loggedOut : true;
          console.log('Connection closed due to', boomError, ', reconnecting:', shouldReconnect);
          if (shouldReconnect) {
            startWhatsAppSocket();
          } else {
            console.log('Desconectado permanentemente');
          }
        }
      } else if (connection === 'open') {
        console.log('Conexão aberta com sucesso');
        // Salva as credenciais após a conexão ser estabelecida
        await saveCreds();
      }
    });

    // Listener para novas mensagens
    sock.ev.on('messages.upsert', async ({ messages }) => {
      const message = messages[0];
      if (!message.key.fromMe && message.message) {
        console.log('Respondendo para', message.key.remoteJid);
        console.log('Mensagem recebida:', JSON.stringify(message, undefined, 2)); // Log da mensagem recebida
        await utils.handleMessage(sock, message);
      }
    });

    // Listener para atualização de credenciais
    sock.ev.on('creds.update', saveCreds);

    // Cria as pastas necessárias se não existirem
    const folders = ['audio', 'video', 'images'];
    for (const folder of folders) {
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder);
        console.log(`Pasta '${folder}' criada.`);
      }
    }
  } catch (error) {
    console.error('Falha ao iniciar o socket do WhatsApp:', error);
    // Tenta reiniciar a conexão após um erro
    setTimeout(startWhatsAppSocket, 5000);
  }
}

// Inicia o socket do WhatsApp
startWhatsAppSocket();
