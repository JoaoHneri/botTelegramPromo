import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { NewMessage } from "telegram/events/index.js";
import input from "input";
import "dotenv/config";


const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH || "";
const SESSION_STRING = process.env.TELEGRAM_SESSION_STRING || "";

const stringSession = new StringSession(SESSION_STRING.trim());

const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5,
});

// 🤖 Dados do bot
const BOT_TOKEN = process.env.BOT_TOKEN || "";
const BOT_CHAT_ID = process.env.BOT_CHAT_ID || "";

if (!apiId || !apiHash || !SESSION_STRING || !BOT_TOKEN || !BOT_CHAT_ID) {
  throw new Error("Variáveis de ambiente obrigatórias não configuradas.");
}

// ⏱️ Tempo mínimo para ignorar mensagens idênticas
// Exemplo: se a mesma mensagem aparecer de novo em até 60 segundos, ignora.
// Se aparecer depois disso, notifica normalmente.
const DUPLICATE_IGNORE_MS = 60 * 1000;

// 🔎 Palavras que indicam produtos desejados
const PRIORITY_NOTEBOOKS = [
  // VAIO FE16 Ryzen 7 5825U
  "vaio fe16",
  "fe16",
  "ryzen 7 5825u",
  "5825u",
  "r7 5825u",
  "bug",

  // Lenovo IdeaPad Slim 3
  "lenovo ideapad slim 3",
  "ideapad slim 3",
  "slim 3i",
  "slim 3",
  "idea pad slim 3",
];

const NOTEBOOK_KEYWORDS = [
  "notebook",
  "laptop",
  "ultrabook",

  // marcas
  "lenovo",
  "vaio",
  "dell",
  "acer",
  "asus",
  "samsung",
  "positivo",
  "avell",
  "hp",

  // linhas/modelos
  "ideapad",
  "idea pad",
  "slim",
  "slim 3",
  "slim 3i",
  "fe16",
  "inspiron",
  "aspire",
  "vivobook",
  "book",
  "galaxy book",

  // processadores comuns
  "ryzen",
  "ryzen 3",
  "ryzen 5",
  "ryzen 7",
  "i3",
  "i5",
  "i7",
  "i9",
  "intel",
  "amd",

  // alguns modelos/chips específicos
  "5825u",
  "5625u",
  "5500u",
  "5700u",
  "7520u",
  "7730u",
  "13420h",
  "1235u",
  "12450h",
];



const KEYWORDS = [
  ...PRIORITY_NOTEBOOKS,
  ...NOTEBOOK_KEYWORDS,
];

// 🚫 Palavras que queremos ignorar
const NEGATIVE = [
  "capa",
  "case",
  "suporte para notebook",
  "suporte notebook",
  "base para notebook",
  "base notebook",
  "cooler para notebook",
  "cooler notebook",
  "carregador",
  "fonte para notebook",
  "fonte notebook",
  "bateria para notebook",
  "bateria notebook",
  "pelicula",
  "película",
  "adesivo",
  "mousepad",
];

function isPriorityNotebook(message: string): boolean {
  return getMatchedKeyword(message, PRIORITY_NOTEBOOKS) !== null;
}

// 💰 Regex de preço
// Aceita:
// R$ 61
// R$61
// R$ 164
// R$ 2.699
// R$ 2.699,90
// R$269,90
const PRICE_REGEX = /r\$\s*\d{1,6}(?:[.,]\d{2,3})*/i;

// Guarda últimas mensagens vistas
const recentMessages = new Map<string, number>();

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getMessageText(event: any): string {
  return (
    event.message?.rawText ||
    event.message?.message ||
    event.message?.text ||
    ""
  );
}

function getMatchedKeyword(message: string, keywords: string[]): string | null {
  const normalizedMessage = normalizeText(message);

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword);

    if (normalizedMessage.includes(normalizedKeyword)) {
      return keyword;
    }
  }

  return null;
}

function hasPrice(message: string): boolean {
  return PRICE_REGEX.test(message);
}

function isOwnNotification(message: string): boolean {
  const normalized = normalizeText(message);

  return (
    normalized.includes("possivel promocao encontrada") ||
    normalized.includes("palavra encontrada")
  );
}

function createDuplicateKey(message: string): string {
  return normalizeText(message);
}

function isDuplicateInShortTime(message: string): boolean {
  const key = createDuplicateKey(message);
  const now = Date.now();
  const lastSeenAt = recentMessages.get(key);

  recentMessages.set(key, now);

  if (!lastSeenAt) {
    return false;
  }

  const diff = now - lastSeenAt;

  return diff <= DUPLICATE_IGNORE_MS;
}

function cleanupOldMessages() {
  const now = Date.now();

  for (const [key, timestamp] of recentMessages.entries()) {
    if (now - timestamp > DUPLICATE_IGNORE_MS * 5) {
      recentMessages.delete(key);
    }
  }
}

async function sendBotNotification(text: string) {
  if (!BOT_TOKEN || BOT_TOKEN === "SEU_BOT_TOKEN_AQUI") {
    console.log("❌ BOT_TOKEN não configurado.");
    return;
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: BOT_CHAT_ID,
      text,
      disable_web_page_preview: false,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.log("❌ Erro ao enviar notificação pelo bot:");
    console.log(data);
    return;
  }

  console.log("✅ Notificação enviada pelo bot.");
}

async function showAccountAndGroups() {
  const me = await client.getMe();

  console.log("👤 Conta logada:");
  console.log(me.username || me.firstName || me.id.toString());

  console.log("📚 Buscando grupos/canais da conta...");

  const dialogs = await client.getDialogs({
    limit: 500,
  });

  console.log(`📚 Total de conversas encontradas: ${dialogs.length}`);

  console.log("📚 Grupos/canais/chats encontrados:");
  for (const dialog of dialogs) {
    console.log("-", dialog.name);
  }

  console.log("-----------------------------------");
}

(async () => {
  console.log("🚀 Iniciando...");

  await client.start({
    phoneNumber: async () => await input.text("📱 Número: "),
    password: async () => await input.text("🔒 Senha 2FA, se tiver: "),
    phoneCode: async () => await input.text("📩 Código recebido: "),
    onError: (err) => console.log(err),
  });

  console.log("✅ Logado!");

  const savedSession = client.session.save();

  console.log("SESSION STRING:");
  console.log(savedSession);

  await showAccountAndGroups();

  console.log("🔍 Monitorando grupos, canais e chats...");

  client.addEventHandler(
    async (event: any) => {
      try {
        console.log("📩 EVENTO RECEBIDO");

        const message = getMessageText(event);

        if (!message) {
          console.log("⏭️ Evento recebido, mas sem texto.");
          console.log("-----------------------------------");
          return;
        }

        // 🚫 Evita loop infinito com a própria mensagem enviada pelo bot
        if (isOwnNotification(message)) {
          console.log("⏭️ Ignorado: mensagem gerada pelo próprio bot.");
          console.log("-----------------------------------");
          return;
        }

        console.log("📝 Texto recebido:");
        console.log(message);
        console.log("-----------------------------------");

        const matchedKeyword = getMatchedKeyword(message, KEYWORDS);
        const matchedNegative = getMatchedKeyword(message, NEGATIVE);
        const foundPrice = hasPrice(message);

        
        console.log("🔎 Palavra encontrada:", matchedKeyword);
        console.log("🚫 Palavra negativa:", matchedNegative);
        console.log("💰 Tem preço:", foundPrice);

        if (!matchedKeyword) {
          console.log("⏭️ Ignorado: sem palavra-chave.");
          console.log("-----------------------------------");
          return;
        }

        if (matchedNegative) {
          console.log(`⏭️ Ignorado: contém palavra negativa: ${matchedNegative}`);
          console.log("-----------------------------------");
          return;
        }

        if (!foundPrice) {
          console.log("⏭️ Ignorado: sem preço.");
          console.log("-----------------------------------");
          return;
        }

        cleanupOldMessages();

        if (isDuplicateInShortTime(message)) {
          console.log(
            `⏭️ Ignorado: mensagem idêntica recebida em menos de ${
              DUPLICATE_IGNORE_MS / 1000
            } segundos.`
          );
          console.log("-----------------------------------");
          return;
        }

        console.log("🔥 PROMOÇÃO ENCONTRADA!");
        console.log("-----------------------------------");

       const priority = isPriorityNotebook(message);

        await sendBotNotification(`${priority ? "🚨 NOTEBOOK PRIORITÁRIO ENCONTRADO" : "🔥 Possível promoção encontrada"}

        🔎 Palavra encontrada: ${matchedKeyword}
        ${priority ? "⭐ Modelo de preferência detectado" : ""}

        ${message}`);

        console.log("-----------------------------------");
      } catch (err) {
        console.error("Erro no handler:", err);
      }
    },
    new NewMessage({})
  );

  console.log("✅ Listener ativo. Aguardando novas mensagens...");

  process.stdin.resume();
})();