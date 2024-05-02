// SRC/UTILS/UTILS.JS:
import axios from 'axios';
import dotenv from "dotenv";
import OpenAI from "openai";
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import * as fs from 'fs';
import extensoes from './extensoes.js';

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;
const openai = new OpenAI();

const messageBuffer = {};
const messageTimers = {};
const bufferTime = 5000; // Corrigido para 5000 milissegundos (5 segundos)

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

async function audio(path1, maxRetries = 3, delay = 1000) {
  let attempts = 0;
  while (attempts < maxRetries) {
    try {
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(path1),
        model: "whisper-1",
        fileType: "ogg",
      });
      return transcription.text;
    } catch (error) {
      attempts++;
      console.log(`Tentativa ${attempts} falhou. Tentando novamente...`);
      if (attempts >= maxRetries) {
        console.error("Máximo de tentativas atingido. Retornando string vazia.");
        return "";
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return "";
}

function encodeImage(imagePath) {
  const image = fs.readFileSync(`${imagePath}`);
  return Buffer.from(image).toString('base64');
}

async function transcryptImage(imagePath) {
  const base64Image = encodeImage(imagePath);

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`
  };

  const payload = {
    model: "gpt-4-vision-preview",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Descreva o que está na imagem.`
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`
            }
          }
        ]
      }
    ],
    max_tokens: 300
  };

  try {
    const response = await axios.post("https://api.openai.com/v1/chat/completions", payload, { headers });
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error:', error);
    return "";
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

async function query(data) {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const response = await axios.post(process.env.FLOWISE_ENDPOINT_URL, data, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.status !== 200) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      return response.data;
    } catch (error) {
      console.error(`Attempt ${attempts + 1} failed: ${error}`);
      attempts += 1;

      if (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempts));
      }
    }
  }

  return "não foi possível processar a solicitação, tente novamente mais tarde";
}

async function handleMessage(client, message) {
  try {
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
      default:
        console.log('Tipo de mensagem não suportado.');
        input = 'Olá, como posso ajudar?'; // Mensagem de boas-vindas padrão
    }

    const contextInfo = message.message[messageType]?.contextInfo;
    if (contextInfo?.quotedMessage) {
      const quotedMessage = contextInfo;
      input += " " + await extensoes.quoted(quotedMessage, input);
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
          "question": fullMessage,
          "overrideConfig": {
            "sessionId": message.key.remoteJid
          }
        });

        const textoResposta = apiResponse.text.toLowerCase();
        console.log("Texto da resposta: ", textoResposta);

        await client.sendMessage(message.key.remoteJid, { text: apiResponse.text.replace(/\]\(/g, ': ').replace(/\[|\]|\(|\)/g, '').replace(/\*\(/g, "") });
      } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
      }
    }, bufferTime);

    return true;
  } catch (error) {
    console.error('Erro ao processar mensagem:', error);
    return false;
  }
}

export default { audio, transcryptImage, extractAudioFromVideo, handleMessage };