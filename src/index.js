import { makeWASocket, fetchLatestBaileysVersion, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import utils from './utils/utils.js';
import fs from 'fs';
import path from 'path';

// Função para salvar as informações da sessão em um arquivo JSON
function saveSessionInfo(sessionInfo) {
  const sessionFilePath = path.join('./auth_info', 'session_info.json');
  fs.writeFileSync(sessionFilePath, JSON.stringify(sessionInfo, null, 2));
}

// Função para carregar as informações da sessão de um arquivo JSON
function loadSessionInfo() {
  const sessionFilePath = path.join('./auth_info', 'session_info.json');
  if (fs.existsSync(sessionFilePath)) {
    const sessionInfo = fs.readFileSync(sessionFilePath, 'utf-8');
    return JSON.parse(sessionInfo);
  }
  return null;
}

async function startWhatsAppSocket() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    const { version } = await fetchLatestBaileysVersion();

    // Carregar informações da sessão, se existirem
    const sessionInfo = loadSessionInfo();
    if (sessionInfo) {
      console.log('Restaurando sessão...');
      // Aqui você pode restaurar as informações da sessão, se necessário
    }

    const sock = makeWASocket({
      printQRInTerminal: true,
      auth: state,
      version,
    });

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === 'close') {
        if (lastDisconnect && 'error' in lastDisconnect && lastDisconnect.error) {
          const boomError = lastDisconnect.error;
          const shouldReconnect = boomError.output.statusCode !== DisconnectReason.loggedOut;
          console.log('connection closed due to ', boomError, ', reconnecting ', shouldReconnect);
          if (shouldReconnect) {
            startWhatsAppSocket();
          }
        }
      } else if (connection === 'open') {
        console.log('opened connection');
        // Salvar informações da sessão quando a conexão é aberta
        saveSessionInfo({
          state: state,
          version: version,
          // Adicione outras informações que você deseja salvar
        });
      }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
      const message = messages[0];
      console.log(JSON.stringify(message, undefined, 2));
      if (!message.key.fromMe) {
        console.log('replying to', message.key.remoteJid);
        await utils.handleMessage(sock, message);
      }
    });

    sock.ev.on('creds.update', saveCreds);

    // Criar as pastas necessárias se não existirem
    const folders = ['audio', 'video', 'images'];
    for (const folder of folders) {
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder);
      }
    }
  } catch (error) {
    console.error('Failed to start WhatsApp socket:', error);
  }
}

startWhatsAppSocket();
