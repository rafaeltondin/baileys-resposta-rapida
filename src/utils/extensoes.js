// baileys-resposta-rapida-main/src/utils/extensoes.js

import * as path from 'path';
import * as fs from 'fs/promises';
import * as mime from 'mime-types';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import utils from './utils.js';

async function saveMediaFile(buffer, fileName) {
  const filePath = path.join(fileName);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

async function processVideo(message) {
  const buffer = await downloadMediaMessage(message, 'buffer', {});
  const videoFileName = `video/${message.key.id}.${mime.extension(message.message.videoMessage.mimetype)}`;
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
  const imageFileName = `images/${message.key.id}.jpg`; // Altere para o formato correto
  await saveMediaFile(buffer, imageFileName);

  // Chame a função transcryptImage com o caminho da imagem
  const imgTranscription = await utils.transcryptImage(imageFileName);
  return `Tente encontrar os produtos mais similares à descrição a seguir: ${imgTranscription}`;
}

async function processAudio(message) {
  const buffer = await downloadMediaMessage(message, 'buffer', {});
  const audioFileName = `audio/${message.key.id}.ogg`; // Alterado para .ogg
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
    quotedText = quotedMessage.conversation;
    response = `mensagem atual ${primaryMessage} \n mensagem recuperada: ${quotedText}`;
  } else if (quotedMessage?.extendedTextMessage) {
    quotedText = quotedMessage.extendedTextMessage.text;
    response = `mensagem atual ${primaryMessage} \n mensagem recuperada: ${quotedText}`;
  } else {
    console.log("fileSha256 não está disponível para a mensagem citada.");
  }
  console.log(response.trim());
  return response.trim();
}

export default { processText, processAudio, processImage, processVideo, quoted };
