// src/utils/utils.js
import axios from 'axios';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import * as fs from 'fs';
import path from 'path';
import extensoes from './extensoes.js';

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;
const openai = new OpenAI({
  apiKey: apiKey,
});

const messageBuffer = {};
const messageTimers = {};
const bufferTime = 5000; // Tempo de buffer em milissegundos (5 segundos)

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Função para codificar imagem em base64
function encodeImage(imagePath) {
  const image = fs.readFileSync(imagePath);
  return Buffer.from(image).toString('base64');
}

async function transcryptImage(imagePath) {
  const base64Image = encodeImage(imagePath);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  const payload = {
    model: 'gpt-4', // Correção do modelo
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Descreva o que está na imagem.',
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`,
            },
          },
        ],
      },
    ],
    max_tokens: 300,
  };

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', payload, { headers });
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
    return '';
  }
}

async function extractAudioFromVideo(videoFilePath, audioOutputPath) {
  return new Promise((resolve) => {
    ffmpeg(videoFilePath)
      .output(audioOutputPath)
      .audioCodec('libopus')
      .on('end', () => {
        console.log(`Áudio extraído e salvo em: ${audioOutputPath}`);
        resolve(true);
      })
      .on('error', (err) => {
        console.error(`Erro ao extrair áudio: ${err.message}`);
        resolve(false);
      })
      .run();
  });
}

async function audio(path1, maxRetries = 3, delay = 1000) {
  let attempts = 0;
  while (attempts < maxRetries) {
    try {
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(path1),
        model: 'whisper-1',
        fileType: 'ogg',
      });
      return transcription.text;
    } catch (error) {
      attempts++;
      console.log(`Tentativa ${attempts} falhou. Tentando novamente...`);
      if (attempts >= maxRetries) {
        console.error('Máximo de tentativas atingido. Retornando string vazia.');
        return '';
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return '';
}

async function saveMediaFile(buffer, fileName) {
  const filePath = path.join(fileName);
  await fs.promises.writeFile(filePath, buffer);
  return filePath;
}

async function processVideo(message) {
  const buffer = await downloadMediaMessage(message, 'buffer', {});
  const videoFileName = `video/${message.key.id}.${mime.extension(message.message.videoMessage.mimetype)}`;
  const videoFilePath = await saveMediaFile(buffer, videoFileName);
  const audioPath = `audio/${message.key.id}.ogg`; // Alterado para .ogg
  const audioExtracted = await extractAudioFromVideo(videoFilePath, audioPath);
  if (!audioExtracted) {
    console.log("Este vídeo não contém áudio ou o áudio não pôde ser extraído.");
    return "audio não processado";
  } else {
    const transcription = await audio(audioPath);
    if (transcription.trim() === '') {
      return "O áudio extraído não pôde ser transcrevido. Responda de acordo com o contexto da conversa.";
    } else {
      return transcription;
    }
  }
}

async function processImage(message) {
  const buffer = await downloadMediaMessage(message, 'buffer', {});
  const imageFileName = `images/${message.key.id}.${mime.extension(message.message.imageMessage.mimetype)}`;
  const imageFilePath = await saveMediaFile(buffer, imageFileName);
  const imgTranscription = await transcryptImage(imageFilePath);
  return `Tente encontrar os produtos mais similares a descrição a seguir: ${imgTranscription}`;
}

async function processAudio(message) {
  const buffer = await downloadMediaMessage(message, 'buffer', {});
  const audioFileName = `audio/${message.key.id}.ogg`; // Alterado para .ogg
  await saveMediaFile(buffer, audioFileName);
  const audioTranscription = await audio(audioFileName);
  console.log(audioTranscription);
  return audioTranscription;
}

async function processText(message) {
  let input = message.message.extendedTextMessage.text || '';
  return input;
}

async function quoted(contextInfo, primaryMessage) {
  let response = primaryMessage;
  let quotedText = '';
  const quotedMessage = contextInfo.quotedMessage;

  if (contextInfo.participant === "554797653226@s.whatsapp.net") {
    quotedText = quotedMessage.conversation || quotedMessage.extendedTextMessage?.text || '';
    response = `Mensagem atual: ${primaryMessage}\nMensagem recuperada: ${quotedText}`;
  } else if (quotedMessage?.extendedTextMessage) {
    quotedText = quotedMessage.extendedTextMessage.text;
    response = `Mensagem atual: ${primaryMessage}\nMensagem recuperada: ${quotedText}`;
  } else if (quotedMessage?.conversation) {
    quotedText = quotedMessage.conversation;
    response = `Mensagem atual: ${primaryMessage}\nMensagem recuperada: ${quotedText}`;
  } else {
    console.log("Tipo de mensagem citada não suportado.");
  }
  console.log(response.trim());
  return response.trim();
}

async function handleUnsupportedMessage(messageType) {
  console.log(`Tipo de mensagem não suportado: ${messageType}. Enviando resposta padrão.`);
  return 'Desculpe, não consigo processar este tipo de mensagem no momento.';
}

async function query(data) {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const response = await axios.post(process.env.FLOWISE_ENDPOINT_URL, data, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.status !== 200) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      return response.data;
    } catch (error) {
      console.error(`Attempt ${attempts + 1} failed: ${error.response ? error.response.data : error.message}`);
      attempts += 1;

      if (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempts));
      }
    }
  }

  return 'Não foi possível processar a solicitação, tente novamente mais tarde';
}

async function handleMessage(client, message) {
  try {
    const isGroup = message.key.remoteJid?.endsWith('@g.us');
    const allowedNumber = '555499000753@s.whatsapp.net';

    if (isGroup && message.key.participant !== allowedNumber) {
      console.log('Mensagem de grupo ignorada - remetente não autorizado');
      return false;
    }

    let input = '';
    const messageType = Object.keys(message.message)[0];

    switch (messageType) {
      case 'conversation':
        input = message.message.conversation;
        break;
      case 'videoMessage':
        input = await extensoes.processVideo(message);
        break;
      case 'imageMessage':
        input = await extensoes.processImage(message);
        break;
      case 'audioMessage':
        input = await extensoes.processAudio(message);
        break;
      case 'extendedTextMessage':
        input = await extensoes.processText(message);
        break;
      case 'senderKeyDistributionMessage': // Tratamento para senderKeyDistributionMessage
        console.log('Tipo de mensagem não suportado: senderKeyDistributionMessage. Enviando resposta padrão.');
        input = 'Desculpe, não consigo processar este tipo de mensagem no momento.';
        break;
      default:
        input = await handleUnsupportedMessage(messageType);
        break;
    }

    const contextInfo = message.message[messageType]?.contextInfo;
    if (contextInfo?.quotedMessage) {
      input += ' ' + await extensoes.quoted(contextInfo, input);
    }

    if (!messageBuffer[message.key.remoteJid]) {
      messageBuffer[message.key.remoteJid] = [];
    }

    messageBuffer[message.key.remoteJid].push(input);

    if (messageTimers[message.key.remoteJid]) {
      clearTimeout(messageTimers[message.key.remoteJid]);
    }

    messageTimers[message.key.remoteJid] = setTimeout(async () => {
      try {
        const fullMessage = messageBuffer[message.key.remoteJid].join(' ');
        delete messageBuffer[message.key.remoteJid];
        delete messageTimers[message.key.remoteJid];

        const apiResponse = await query({
          question: fullMessage,
          overrideConfig: {
            sessionId: message.key.remoteJid,
          },
        });

        const textoResposta = apiResponse.text.toLowerCase();
        console.log('Texto da resposta: ', textoResposta);

        await client.sendMessage(message.key.remoteJid, { text: apiResponse.text.replace(/:\s*$/, '') });

        // Salvar as informações da sessão após processar a mensagem
        // Nota: As informações de sessão agora são gerenciadas exclusivamente em index.js
      } catch (error) {
        console.error('Erro ao enviar mensagem:', error.response ? error.response.data : error.message);
      }
    }, bufferTime);

    return true;
  } catch (error) {
    console.error('Erro ao processar mensagem:', error);
    return false;
  }
}

export default {
  audio,
  transcryptImage,
  extractAudioFromVideo,
  handleMessage,
};
