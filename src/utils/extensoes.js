// src/utils/extensoes.js
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import utils from './utils.js';
import mime from 'mime-types';
import path from 'path';
import fs from 'fs/promises';

// Função para salvar arquivos de mídia
async function saveMediaFile(buffer, fileName) {
  const filePath = path.join(fileName);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

async function processVideo(message) {
  const buffer = await downloadMediaMessage(message, 'buffer', {});
  const videoMime = message.message.videoMessage.mimetype || 'video/mp4'; // Garantir que mimetype exista
  const videoExtension = mime.extension(videoMime) || 'mp4';
  const videoFileName = `video/${message.key.id}.${videoExtension}`;
  const videoFilePath = await saveMediaFile(buffer, videoFileName);
  const audioPath = `audio/${message.key.id}.ogg`; // Alterado para .ogg
  const audioExtracted = await utils.extractAudioFromVideo(videoFilePath, audioPath);
  if (!audioExtracted) {
    console.log("Este vídeo não contém áudio ou o áudio não pôde ser extraído.");
    return "audio não processado";
  } else {
    const transcription = await utils.audio(audioPath);
    if (transcription.trim() === '') {
      return "O áudio extraído não pôde ser transcrevido. Responda de acordo com o contexto da conversa.";
    } else {
      return transcription;
    }
  }
}

async function processImage(message) {
  const buffer = await downloadMediaMessage(message, 'buffer', {});
  const imageMime = message.message.imageMessage.mimetype || 'image/jpeg'; // Garantir que mimetype exista
  const imageExtension = mime.extension(imageMime) || 'jpg';
  const imageFileName = `images/${message.key.id}.${imageExtension}`;
  const imageFilePath = await saveMediaFile(buffer, imageFileName);
  const imgTranscription = await utils.transcryptImage(imageFilePath);
  return `Tente encontrar os produtos mais similares a descrição a seguir: ${imgTranscription}`;
}

async function processAudio(message) {
  const buffer = await downloadMediaMessage(message, 'buffer', {});
  const audioMime = message.message.audioMessage.mimetype || 'audio/ogg'; // Garantir que mimetype exista
  const audioExtension = mime.extension(audioMime) || 'ogg';
  const audioFileName = `audio/${message.key.id}.${audioExtension}`; // Alterado para .ogg
  await saveMediaFile(buffer, audioFileName);
  const audioTranscription = await utils.audio(audioFileName);
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

export default { processText, processAudio, processImage, processVideo, quoted, handleUnsupportedMessage };
