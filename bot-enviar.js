require("dotenv").config();
const fs = require("fs");
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  ChannelSelectMenuBuilder,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
  OverwriteType,
  UserSelectMenuBuilder,
} = require("discord.js");

// ================== CONFIGURACIÓN ==================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
console.log("DEBUG -> TOKEN existe:", !!TOKEN, "| longitud:", TOKEN ? TOKEN.length : 0);
console.log("DEBUG -> CLIENT_ID:", CLIENT_ID);
console.log("DEBUG -> GUILD_ID:", GUILD_ID);
// =====================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences, // necesario para detectar desconexiones (activar en el Developer Portal)
  ],
});

// ================== FILTRO DE MALAS PALABRAS ==================
const PALABRAS_PROHIBIDAS = [
  "mamaguevo",
  "mmg",
  "singa",
  "singar",
  "tu madre",
  "coño",
  "cñ",
  "cn",
  "vaina 'e",
  "hijo de puta",
  "hjdpt",
  "hijo de perra",
  "hdp",
  "jueputa",
  "malparido",
  "singa tu madre",
  "sgtmd",
  "cabron",
  "cabrón",
  "pendejo",
  "maldito",
  "verga",
  "pinga",
  "come mierda",
  "comemierda",
  "guevo",
  "gueva",
  "culo",
  "puta",
  "puto",
  "perra",
  "zorra",
  "cerote",
  "carajo",
  "mierda",
  "imbecil",
  "imbécil",
  "estupido",
  "estúpido",
  "idiota",
];

const DURACION_SUSPENSION_MS = 60 * 60 * 1000;
const historialOfensas = new Map();

function contieneMalaPalabra(texto) {
  const limpio = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return PALABRAS_PROHIBIDAS.some((palabra) => limpio.includes(palabra));
}

client.on("messageCreate", async (mensaje) => {
  if (mensaje.author.bot) return;
  if (!mensaje.guild) return;

  if (contieneMalaPalabra(mensaje.content)) {
    try {
      await mensaje.delete().catch(() => {});

      const member = mensaje.member ?? (await mensaje.guild.members.fetch(mensaje.author.id).catch(() => null));
      if (!member) return;

      const vecesAnterior = historialOfensas.get(member.id) || 0;
      const vecesNueva = vecesAnterior + 1;
      historialOfensas.set(member.id, vecesNueva);

      if (vecesNueva >= 3) {
        if (member.bannable) {
          const dmBan = new EmbedBuilder()
            .setTitle("⛔ Baneado")
            .setDescription(
              `Fuiste baneado de **${mensaje.guild.name}** por usar lenguaje prohibido repetidamente.`
            )
            .setColor(0xed4245);

          await member.send({ embeds: [dmBan] }).catch(() => {});
          await member.ban({ reason: "Uso repetido de lenguaje prohibido (3ra vez)" });

          const avisoBan = new EmbedBuilder()
            .setDescription(`⛔ <@${member.id}> fue **baneado** por usar lenguaje prohibido repetidamente.`)
            .setColor(0xed4245);

          await mensaje.channel.send({ embeds: [avisoBan] });
        }
        historialOfensas.delete(member.id);
        return;
      }

      if (!member.moderatable) {
        return;
      }

      await member.timeout(DURACION_SUSPENSION_MS, "Uso de lenguaje prohibido");

      const aviso = new EmbedBuilder()
        .setDescription(`🔇 <@${member.id}> fue suspendido por 1 hora por usar lenguaje prohibido.`)
        .setColor(0xed4245);

      await mensaje.channel.send({ embeds: [aviso] });

      if (vecesNueva === 2) {
        const dm = new EmbedBuilder()
          .setTitle("⚠️ Advertencia")
          .setDescription(
            `Has usado lenguaje prohibido en **${mensaje.guild.name}** más de una vez. Si vuelves a hacerlo, serás **baneado** del servidor.`
          )
          .setColor(0xffcc00);

        await member.send({ embeds: [dm] }).catch(() => {});
      }
    } catch (e) {
      console.error("Error al aplicar suspensión:", e);
    }
    return;
  }

  // ---- Sumar los "Total:" de los canales de fichaje a la Tabla de Facturas ----
  if (mensaje.channel.topic && mensaje.channel.topic.startsWith("fichaje:")) {
    let suma = 0;
    let cantidad = 0;
    for (const m of mensaje.content.matchAll(/total:\s*\$?\s*([\d.,]+)/gi)) {
      const valor = limpiarNumero(m[1]);
      if (valor > 0) {
        suma += valor;
        cantidad++;
      }
    }

    if (cantidad > 0) {
      const nombre = (mensaje.member?.displayName ?? mensaje.author.username).replace(/\s+/g, "_");
      registrarFactura(mensaje.author.id, nombre, suma, cantidad);
      pedirActualizacionTabla(mensaje.guild);
    }
  }

  const tipoLink = detectarTipoLink(mensaje.content);
  if (tipoLink) {
    mensaje.reply(`🔗 Ese link es de: **${tipoLink}**`).catch(() => {});
  }
});

function detectarTipoLink(texto) {
  const regexUrl = /(https?:\/\/[^\s]+)/i;
  const match = texto.match(regexUrl);
  if (!match) return null;

  const url = match[1].toLowerCase();

  if (url.includes("discord.gg") || url.includes("discord.com/invite")) return "Invitación de Discord";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "YouTube";
  if (url.includes("tiktok.com")) return "TikTok";
  if (url.includes("instagram.com")) return "Instagram";
  if (url.includes("twitter.com") || url.includes("x.com")) return "Twitter / X";
  if (url.includes("facebook.com") || url.includes("fb.com")) return "Facebook";
  if (url.includes("twitch.tv")) return "Twitch";
  if (url.includes("spotify.com")) return "Spotify";
  if (url.includes("github.com")) return "GitHub";
  if (/\.(png|jpe?g|gif|webp)(\?.*)?$/.test(url)) return "Imagen";
  if (/\.(mp4|mov|webm)(\?.*)?$/.test(url)) return "Video";

  try {
    const dominio = new URL(match[1]).hostname.replace("www.", "");
    return `Sitio web (${dominio})`;
  } catch {
    return "Link genérico";
  }
}

// ================== SISTEMA DE TICKETS ==================
// ⚠️ Revisa que este ID sea el de una CATEGORÍA real de tu servidor
// (clic derecho sobre la categoría -> Copiar ID, con el modo desarrollador activado)
const CATEGORIA_TICKETS_ID = "1441676871086641172";

const TIPOS_TICKET = {
  reportar_usuario: {
    label: "Reportar usuario",
    emoji: "🚨",
    description: "Reporta a un usuario que rompe las reglas",
    mensaje:
      "Describe qué usuario quieres reportar y por qué. Si tienes pruebas (capturas, mensajes), adjúntalas aquí.",
  },
  dudas: {
    label: "Dudas",
    emoji: "❓",
    description: "Resuelve tus dudas con el staff",
    mensaje: "Cuéntanos tu duda con el mayor detalle posible y el staff te responderá pronto.",
  },
  sorteo: {
    label: "Reclamar un sorteo",
    emoji: "🎁",
    description: "Reclama un premio que ganaste en un sorteo",
    mensaje:
      "Indica en qué sorteo ganaste y adjunta una prueba (captura del anuncio de ganador) para validar tu premio.",
  },
};

function esCanalDeTicket(canal) {
  return !!canal.topic && canal.topic.startsWith("ticket:");
}

// ================== SISTEMA DE SERVICIOS ==================
// ⚠️ Revisa que este ID sea el de un ROL real de tu servidor
const ROL_SERVICIO_ID = "1441645993627095164";
const CANAL_LOGS_SERVICIO_ID = "1554351355865604147"; // canal de logs: entradas, salidas, desconexiones y quién está en servicio
const ARCHIVO_SERVICIOS = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? `${process.env.RAILWAY_VOLUME_MOUNT_PATH}/servicios_activos.json`
  : "./servicios_activos.json";

// key = `${guildId}:${userId}`
const serviciosActivos = new Map();
const timersServicio = new Map();

function cargarServicios() {
  try {
    if (!fs.existsSync(ARCHIVO_SERVICIOS)) return;
    const data = JSON.parse(fs.readFileSync(ARCHIVO_SERVICIOS, "utf8"));
    for (const entrada of data) {
      const key = `${entrada.guildId}:${entrada.userId}`;
      serviciosActivos.set(key, entrada);
    }
  } catch (e) {
    console.error("Error al cargar servicios_activos.json:", e);
  }
}

function guardarServicios() {
  try {
    const data = Array.from(serviciosActivos.values());
    fs.writeFileSync(ARCHIVO_SERVICIOS, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Error al guardar servicios_activos.json:", e);
  }
}

function programarFinServicio(key, msRestantes) {
  if (timersServicio.has(key)) {
    clearTimeout(timersServicio.get(key));
  }
  const timer = setTimeout(() => {
    finalizarServicio(key, "tiempo");
  }, msRestantes);
  timersServicio.set(key, timer);
}

async function iniciarServicio(interaction, minutos) {
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;
  const key = `${guildId}:${userId}`;

  const inicio = Date.now();
  const fin = inicio + minutos * 60 * 1000;

  const member = await interaction.guild.members.fetch(userId).catch(() => null);
  if (!member) return null;

  await member.roles.add(ROL_SERVICIO_ID).catch((e) => {
    console.error("No se pudo agregar el rol de servicio:", e);
  });

  const entrada = { guildId, userId, minutos, inicio, fin };
  serviciosActivos.set(key, entrada);
  guardarServicios();
  programarFinServicio(key, fin - inicio);

  await logServicio(interaction.guild, `🟢 <@${userId}> **entró** a servicio a las <t:${Math.floor(inicio / 1000)}:T> por **${minutos} minuto(s)**. Termina <t:${Math.floor(fin / 1000)}:R>.`);
  pedirActualizacionRanking(interaction.guild);

  await member
    .send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xfee75c)
          .setTitle("⚠️ Estás en servicio")
          .setDescription(
            `Entraste a servicio por **${minutos} minuto(s)**.\n\n` +
              "🚫 **No puedes desactivarte ni desconectarte de Discord** mientras estés en servicio. " +
              "Si lo haces, se te quitará el servicio automáticamente.\n\n" +
              "Si te vas a salir de trabajar, finaliza tu turno con el botón **Salir de Turno**."
          )
          .setTimestamp(),
      ],
    })
    .catch(() => {});

  return entrada;
}

async function finalizarServicio(key, motivo) {
  const entrada = serviciosActivos.get(key);
  if (!entrada) return;

  const { guildId, userId } = entrada;

  if (timersServicio.has(key)) {
    clearTimeout(timersServicio.get(key));
    timersServicio.delete(key);
  }

  serviciosActivos.delete(key);
  guardarServicios();

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return;

  const member = await guild.members.fetch(userId).catch(() => null);

  // Guarda el tiempo real que duró el servicio (para el ranking de horas)
  sumarHoras(userId, member?.displayName, entrada, motivo === "tiempo" ? entrada.fin : Date.now());

  if (member) {
    await member.roles.remove(ROL_SERVICIO_ID).catch((e) => {
      console.error("No se pudo quitar el rol de servicio:", e);
    });
  }

  const finReal = motivo === "tiempo" ? entrada.fin : Date.now();
  const hora = Math.floor(finReal / 1000);
  const duracion = formatoDuracion(finReal - entrada.inicio);

  const texto =
    motivo === "manual"
      ? `🔴 <@${userId}> **salió** de servicio manualmente a las <t:${hora}:T>. Duración: **${duracion}**.`
      : motivo === "desconexion"
      ? `📴 <@${userId}> se **desconectó de Discord** a las <t:${hora}:T> (<t:${hora}:d>). Se le quitó el servicio. Duración: **${duracion}**.`
      : `⏰ Se cumplió el tiempo de servicio de <@${userId}> a las <t:${hora}:T>, el rol fue removido. Duración: **${duracion}**.`;

  await logServicio(guild, texto, motivo === "desconexion" ? 0xed4245 : motivo === "manual" ? 0xfee75c : 0x57f287);

  // Aviso por mensaje privado
  if (member) {
    const aviso =
      motivo === "desconexion"
        ? {
            titulo: "📴 Se te quitó el servicio",
            desc:
              "Te desconectaste o te pusiste inactivo en Discord mientras estabas en servicio, " +
              "por eso **se te quitó el servicio**.\n\nNo puedes desactivarte ni desconectarte de Discord en pleno turno.",
            color: 0xed4245,
          }
        : motivo === "manual"
        ? { titulo: "🔴 Turno finalizado", desc: "Finalizaste tu turno. Se te quitó el rol de servicio.", color: 0xed4245 }
        : { titulo: "⏰ Tu turno terminó", desc: "Se cumplió el tiempo de tu turno y se te quitó el rol de servicio.", color: 0x57f287 };

    await member
      .send({
        embeds: [new EmbedBuilder().setColor(aviso.color).setTitle(aviso.titulo).setDescription(aviso.desc).setTimestamp()],
      })
      .catch(() => {});
  }

  pedirActualizacionRanking(guild);
}

async function logServicio(guild, texto, color = 0x57f287) {
  if (!CANAL_LOGS_SERVICIO_ID) return;
  const canal = await guild.channels.fetch(CANAL_LOGS_SERVICIO_ID).catch(() => null);
  if (!canal || !canal.isTextBased()) return;

  const embed = new EmbedBuilder().setDescription(texto).setColor(color).setTimestamp();
  await canal.send({ embeds: [embed] }).catch(() => {});
}

// ================== RANKING DE HORAS EN SERVICIO ==================
const CANAL_RANKING_HORAS_ID = "1554346422508195871";
const ARCHIVO_HORAS = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? `${process.env.RAILWAY_VOLUME_MOUNT_PATH}/horas_servicio.json`
  : "./horas_servicio.json";

let datosHoras = { mensajeId: null, mensajeActivosId: null, semanaInicio: 0, usuarios: {} };

function cargarHoras() {
  try {
    if (!fs.existsSync(ARCHIVO_HORAS)) return;
    const data = JSON.parse(fs.readFileSync(ARCHIVO_HORAS, "utf8"));
    datosHoras = {
      mensajeId: data.mensajeId ?? null,
      mensajeActivosId: data.mensajeActivosId ?? null,
      semanaInicio: data.semanaInicio ?? 0,
      usuarios: data.usuarios ?? {},
    };
  } catch (e) {
    console.error("Error al cargar horas_servicio.json:", e);
  }
}

function guardarHoras() {
  try {
    fs.writeFileSync(ARCHIVO_HORAS, JSON.stringify(datosHoras, null, 2));
  } catch (e) {
    console.error("Error al guardar horas_servicio.json:", e);
  }
}

// Último sábado a las 22:00 (hora de República Dominicana, UTC-4)
function inicioSemanaActual() {
  const OFFSET = 4 * 60 * 60 * 1000;
  const d = new Date(Date.now() - OFFSET);
  const diff = (d.getUTCDay() - 6 + 7) % 7;
  let inicio = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff, 22, 0, 0);
  if (inicio > d.getTime()) inicio -= 7 * 24 * 60 * 60 * 1000;
  return inicio + OFFSET;
}

// Si empezó una semana nueva, reinicia el ranking
function revisarSemana() {
  const actual = inicioSemanaActual();
  if (datosHoras.semanaInicio !== actual) {
    datosHoras.semanaInicio = actual;
    datosHoras.usuarios = {};
    guardarHoras();
  }
}

function sumarHoras(userId, nombre, entrada, finReal) {
  revisarSemana();
  const desde = Math.max(entrada.inicio, datosHoras.semanaInicio);
  const ms = Math.max(0, finReal - desde);
  const previo = datosHoras.usuarios[userId] ?? { nombre: nombre ?? null, ms: 0 };
  previo.nombre = nombre ?? previo.nombre;
  previo.ms += ms;
  datosHoras.usuarios[userId] = previo;
  guardarHoras();
}

function formatoDuracion(ms) {
  const totalMin = Math.floor(ms / 60000);
  if (ms > 0 && totalMin < 1) return "1m";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function crearEmbedRanking(guild) {
  revisarSemana();
  const mapa = new Map();

  for (const [id, u] of Object.entries(datosHoras.usuarios)) {
    mapa.set(id, { nombre: u.nombre ?? `<@${id}>`, ms: u.ms });
  }

  // Suma también a quienes están en servicio ahora mismo
  const ahora = Date.now();
  for (const e of serviciosActivos.values()) {
    if (e.guildId !== guild.id) continue;
    const desde = Math.max(e.inicio, datosHoras.semanaInicio);
    const extra = Math.max(0, Math.min(ahora, e.fin) - desde);
    const actual = mapa.get(e.userId) ?? { nombre: `<@${e.userId}>`, ms: 0 };
    actual.ms += extra;
    mapa.set(e.userId, actual);
  }

  const lista = [...mapa.values()].filter((x) => x.ms > 0).sort((a, b) => b.ms - a.ms).slice(0, 15);
  const medallas = ["🥇", "🥈", "🥉"];
  const lineas = lista.map((x, i) => `${medallas[i] ?? `**${i + 1}.**`} ${x.nombre} — ${formatoDuracion(x.ms)}`);

  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(`⏱️ Ranking de Horas en Servicio — ${guild.name}`)
    .setThumbnail(guild.iconURL({ size: 256 }) || null)
    .setDescription(
      (lineas.length ? lineas.join("\n") : "Nadie ha entrado en servicio esta semana.") +
        "\n\n⚠️ Si te vas a salir de trabajar en el taller, **finaliza tu turno**."
    )
    .setFooter({
      text: `Semana desde: ${new Date(datosHoras.semanaInicio).toLocaleString("es-DO", {
        timeZone: "America/Santo_Domingo",
      })} — se reinicia los sábados 22:00`,
      iconURL: guild.iconURL() || undefined,
    })
    .setTimestamp();
}

async function actualizarRanking(guild) {
  const canal = await guild.channels.fetch(CANAL_RANKING_HORAS_ID).catch(() => null);
  if (!canal || !canal.isTextBased()) {
    console.error("No encuentro el canal del ranking de horas.");
    return;
  }

  const embed = crearEmbedRanking(guild);
  let mensaje = null;
  if (datosHoras.mensajeId) {
    mensaje = await canal.messages.fetch(datosHoras.mensajeId).catch(() => null);
  }

  if (mensaje) {
    await mensaje.edit({ embeds: [embed] }).catch((e) => console.error("Error al editar el ranking:", e));
  } else {
    const nuevo = await canal.send({ embeds: [embed] }).catch((e) => {
      console.error("Error al enviar el ranking:", e);
      return null;
    });
    if (nuevo) {
      datosHoras.mensajeId = nuevo.id;
      guardarHoras();
    }
  }
}

// Mensaje en el canal de logs con quiénes tienen el servicio prendido ahora mismo
async function actualizarActivos(guild) {
  if (!CANAL_LOGS_SERVICIO_ID) return;
  const canal = await guild.channels.fetch(CANAL_LOGS_SERVICIO_ID).catch(() => null);
  if (!canal || !canal.isTextBased()) return;

  const lista = [...serviciosActivos.values()]
    .filter((e) => e.guildId === guild.id)
    .sort((a, b) => a.inicio - b.inicio)
    .map(
      (e) =>
        `🟢 <@${e.userId}> — desde <t:${Math.floor(e.inicio / 1000)}:T>, termina <t:${Math.floor(e.fin / 1000)}:R>`
    );

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(`🟢 En servicio ahora (${lista.length})`)
    .setDescription(lista.length ? lista.join("\n") : "Nadie está en servicio ahora mismo.")
    .setTimestamp();

  let mensaje = null;
  if (datosHoras.mensajeActivosId) {
    mensaje = await canal.messages.fetch(datosHoras.mensajeActivosId).catch(() => null);
  }

  if (mensaje) {
    await mensaje.edit({ embeds: [embed] }).catch((e) => console.error("Error al editar en servicio ahora:", e));
  } else {
    const nuevo = await canal.send({ embeds: [embed] }).catch(() => null);
    if (nuevo) {
      datosHoras.mensajeActivosId = nuevo.id;
      guardarHoras();
    }
  }
}

// Cola para que las actualizaciones no se pisen entre sí
let colaRanking = Promise.resolve();
function pedirActualizacionRanking(guild) {
  colaRanking = colaRanking
    .then(() => actualizarRanking(guild))
    .then(() => actualizarActivos(guild))
    .catch(() => {});
}

// ================== SISTEMA DE FICHAJES ==================
// Convierte "10,000" / "10.000" / "1500" en número
function limpiarNumero(txt) {
  return parseInt(String(txt).replace(/[.,]/g, ""), 10) || 0;
}

// Lee los mensajes del canal y suma todas las líneas "Total: X"
async function calcularTotalFichajes(canal, cantidad, usuario) {
  let total = 0;
  let ultimoId;
  let restantes = cantidad;

  while (restantes > 0) {
    const lote = await canal.messages.fetch({
      limit: Math.min(100, restantes),
      ...(ultimoId && { before: ultimoId }),
    });
    if (lote.size === 0) break;

    for (const msg of lote.values()) {
      if (usuario && msg.author.id !== usuario.id) continue;
      const coincidencias = msg.content.matchAll(/total:\s*\$?\s*([\d.,]+)/gi);
      for (const m of coincidencias) total += limpiarNumero(m[1]);
    }

    ultimoId = lote.last().id;
    restantes -= lote.size;
  }

  return total;
}

// ================== PANEL DE FICHAJES (DEMON RACING) ==================
// Opcional: ID de la categoría donde se crean los canales de fichajes.
// Si lo dejas vacío (""), el bot busca una categoría que se llame "Control de Personal".
const CATEGORIA_FICHAJES_ID = "";

function normalizarTexto(txt) {
  return String(txt)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Convierte "Juan Pérez" en "juan-perez" para usarlo en el nombre del canal
function limpiarParaCanal(txt) {
  return normalizarTexto(txt)
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function buscarCategoriaFichajes(guild) {
  await guild.channels.fetch().catch(() => {});
  if (CATEGORIA_FICHAJES_ID) {
    return guild.channels.cache.get(CATEGORIA_FICHAJES_ID) ?? null;
  }
  return (
    guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && normalizarTexto(c.name).includes("control de personal")
    ) ?? null
  );
}

function crearEmbedFormatoFichajes(guild) {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("📋 Formato de fichajes – Demon Racing")
    .setDescription(
      "**Ejemplo:**\n" +
        "```\n" +
        "Cliente: ID: 25366\n" +
        "Servicio: Reparación\n" +
        "Tipo: Carro\n" +
        "Total: 1,500\n\n" +
        "Cliente: ID: 25366\n" +
        "Servicio: Reparación de gomas\n" +
        "Tipo: Carro (VIP)\n" +
        "Total: 10,000\n\n" +
        "Cliente: ID: 25366\n" +
        "Servicio: Reparación de gomas\n" +
        "Tipo: Moto (VIP)\n" +
        "Total: 10,000\n\n" +
        "Cliente: ID: 25366\n" +
        "Servicio: Reparación\n" +
        "Tipo: Moto\n" +
        "Total: 1,000\n" +
        "```\n" +
        "📌 **Formato a usar a partir de hoy:**\n" +
        "```\n" +
        "Cliente: ID:\n" +
        "Servicio:\n" +
        "Tipo:\n" +
        "Total:\n" +
        "```\n" +
        "⚠️ **Advertencia:** el límite es de **200k**."
    )
    .setFooter({ text: "Demon Racing • Fichajes", iconURL: guild.iconURL() || undefined })
    .setTimestamp();
}

// ================== CANALES PRIVADOS (SOLO STAFF) ==================
// Estos roles son los únicos que ven los canales/categorías creados con /crear-canal y /crear-categoria
const ROLES_STAFF_CANALES = [
  "1519055985526702220",
  "1441778132180009081",
  "1471124977356111954",
  "1441594428727754894",
  "1466587830729052435",
  "1441645297540268105",
];

const PERMISOS_VER_Y_HABLAR = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.Connect,
  PermissionFlagsBits.Speak,
];

// Everyone no ve nada. Solo ven: los roles del staff, el bot y las personas que indiques.
function permisosPrivados(guild, usuarioIds = []) {
  const rolesValidos = ROLES_STAFF_CANALES.filter((id) => guild.roles.cache.has(id));
  const miembros = [guild.members.me.id, ...usuarioIds];

  return [
    { id: guild.roles.everyone.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] },
    ...rolesValidos.map((id) => ({ id, type: OverwriteType.Role, allow: PERMISOS_VER_Y_HABLAR })),
    ...miembros.map((id) => ({ id, type: OverwriteType.Member, allow: PERMISOS_VER_Y_HABLAR })),
  ];
}

// Solo el staff (los roles de arriba) o un administrador puede crear/cerrar fichajes y cobrar
function puedeCrearFichajes(member) {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.roles.cache.some((r) => ROLES_STAFF_CANALES.includes(r.id))
  );
}

// ================== TABLA DE FACTURAS ==================
const CANAL_TABLA_FACTURAS_ID = "1455605689564008501";
const PORCENTAJE_GENERAL = 0.25; // porcentaje que se aplica a todos en /cobrar-todos
const ARCHIVO_FACTURAS = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? `${process.env.RAILWAY_VOLUME_MOUNT_PATH}/facturas.json`
  : "./facturas.json";

let datosFacturas = { mensajeId: null, empleados: {} };

function cargarFacturas() {
  try {
    if (!fs.existsSync(ARCHIVO_FACTURAS)) return;
    const data = JSON.parse(fs.readFileSync(ARCHIVO_FACTURAS, "utf8"));
    datosFacturas = { mensajeId: data.mensajeId ?? null, empleados: data.empleados ?? {} };
  } catch (e) {
    console.error("Error al cargar facturas.json:", e);
  }
}

function guardarFacturas() {
  try {
    fs.writeFileSync(ARCHIVO_FACTURAS, JSON.stringify(datosFacturas, null, 2));
  } catch (e) {
    console.error("Error al guardar facturas.json:", e);
  }
}

function formatoDinero(n) {
  return "$" + Number(n).toLocaleString("en-US");
}

function normalizarPorcentaje(p) {
  return p > 1 ? p / 100 : p; // 25 -> 0.25
}

function textoPorcentaje(p) {
  return `${Math.round(p * 10000) / 100}%`;
}

function registrarFactura(userId, nombre, monto, cantidad) {
  const emp = datosFacturas.empleados[userId] ?? { nombre, facturas: 0, total: 0 };
  emp.nombre = nombre;
  emp.facturas += cantidad;
  emp.total += monto;
  datosFacturas.empleados[userId] = emp;
  guardarFacturas();
}

// La tabla queda en blanco (solo encabezados, $0 y 0 facturas) hasta que alguien digite
function crearEmbedTabla() {
  const lista = Object.values(datosFacturas.empleados)
    .filter((e) => e.facturas > 0)
    .sort((a, b) => b.total - a.total);

  const totalGeneral = lista.reduce((s, e) => s + e.total, 0);
  const facturasGeneral = lista.reduce((s, e) => s + e.facturas, 0);

  const anchoNombre = Math.max(8, ...lista.map((e) => e.nombre.length));
  const anchoTotal = Math.max(5, ...lista.map((e) => formatoDinero(e.total).length));
  const encabezado = `${"EMPLEADO".padEnd(anchoNombre)} | FACTURAS | ${"TOTAL".padStart(anchoTotal)}`;
  const linea = "-".repeat(encabezado.length);
  const filas = lista.map(
    (e) =>
      `${e.nombre.padEnd(anchoNombre)} | ${String(e.facturas).padStart(8)} | ${formatoDinero(e.total).padStart(anchoTotal)}`
  );

  return new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle("Tabla de Facturas")
    .setDescription("```\n" + [encabezado, linea, ...filas].join("\n") + "\n```")
    .addFields(
      { name: "Total", value: `**${formatoDinero(totalGeneral)}**`, inline: true },
      { name: "Facturas", value: `**${facturasGeneral}**`, inline: true }
    )
    .setFooter({ text: "Actualización automática" })
    .setTimestamp();
}

// Edita el mismo mensaje de la tabla; solo publica uno nuevo si no existe
async function actualizarTablaFacturas(guild) {
  const canal = await guild.channels.fetch(CANAL_TABLA_FACTURAS_ID).catch(() => null);
  if (!canal || !canal.isTextBased()) {
    console.error("No encuentro el canal de la tabla de facturas.");
    return;
  }

  const embed = crearEmbedTabla();
  let mensaje = null;
  if (datosFacturas.mensajeId) {
    mensaje = await canal.messages.fetch(datosFacturas.mensajeId).catch(() => null);
  }

  if (mensaje) {
    await mensaje.edit({ embeds: [embed] }).catch((e) => console.error("Error al editar la tabla:", e));
  } else {
    const nuevo = await canal.send({ embeds: [embed] }).catch((e) => {
      console.error("Error al enviar la tabla:", e);
      return null;
    });
    if (nuevo) {
      datosFacturas.mensajeId = nuevo.id;
      guardarFacturas();
    }
  }
}

// Cola para que las actualizaciones no se pisen entre sí
let colaTabla = Promise.resolve();
function pedirActualizacionTabla(guild) {
  colaTabla = colaTabla.then(() => actualizarTablaFacturas(guild)).catch(() => {});
}

// ================== SISTEMA DE VERIFICACIÓN (NOMBRE + ID) ==================
// Roles que recibe la persona al verificarse
const ROLES_VERIFICADOS_IDS = ["1441645763716448276", "1442275631793700985"];
// Rol "sin verificar" que se quita al verificarse (opcional, déjalo "" si no tienes)
const ROL_SIN_VERIFICAR_ID = "";
// Canal donde el bot avisa verificaciones e intentos de ID repetido (opcional, "" = sin logs)
const CANAL_LOGS_VERIFICACION_ID = "";

const ARCHIVO_VERIFICACIONES = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? `${process.env.RAILWAY_VOLUME_MOUNT_PATH}/verificaciones.json`
  : "./verificaciones.json";

const COLOR_PRINCIPAL = 0xed4245;
const COLOR_OK = 0x57f287;
const COLOR_AVISO = 0xfee75c;

// verificados: { "25366": { userId, nombre, fecha, origen } }
let datosVerif = { verificados: {} };

function cargarVerificaciones() {
  try {
    if (!fs.existsSync(ARCHIVO_VERIFICACIONES)) return;
    const data = JSON.parse(fs.readFileSync(ARCHIVO_VERIFICACIONES, "utf8"));
    datosVerif = { verificados: data.verificados ?? {} };
  } catch (e) {
    console.error("Error al cargar verificaciones.json:", e);
  }
}

function guardarVerificaciones() {
  try {
    fs.writeFileSync(ARCHIVO_VERIFICACIONES, JSON.stringify(datosVerif, null, 2));
  } catch (e) {
    console.error("Error al guardar verificaciones.json:", e);
  }
}

function buscarPorUsuario(userId) {
  const entrada = Object.entries(datosVerif.verificados).find(([, v]) => v.userId === userId);
  return entrada ? { id: entrada[0], ...entrada[1] } : null;
}

function esStaffVerif(member) {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageRoles)
  );
}

function limpiarId(txt) {
  return String(txt).replace(/\s+/g, "");
}

function idValido(id) {
  return /^\d{1,10}$/.test(id);
}

// Saca el ID de un apodo tipo "Santana | 25366" o "Santana 25366"
function extraerIdDeApodo(apodo) {
  const numeros = String(apodo).match(/\d{3,10}/g);
  return numeros ? numeros[numeros.length - 1] : null;
}

function recortarLista(lineas, max = 1000) {
  let texto = "";
  let mostrados = 0;
  for (const l of lineas) {
    if ((texto + l + "\n").length > max) break;
    texto += l + "\n";
    mostrados++;
  }
  const faltan = lineas.length - mostrados;
  if (faltan > 0) texto += `… y ${faltan} más`;
  return texto.trim() || "—";
}

async function logVerificacion(guild, embed) {
  if (!CANAL_LOGS_VERIFICACION_ID) return;
  const canal = await guild.channels.fetch(CANAL_LOGS_VERIFICACION_ID).catch(() => null);
  if (!canal || !canal.isTextBased()) return;
  await canal.send({ embeds: [embed] }).catch(() => {});
}

function crearEmbedPanelVerificacion(guild) {
  return new EmbedBuilder()
    .setColor(COLOR_PRINCIPAL)
    .setTitle("✅ Verificación — Demon Racing")
    .setThumbnail(guild.iconURL({ size: 256 }) || null)
    .setDescription(
      "Para acceder al servidor debes verificarte con tu **nombre** y tu **ID**.\n\n" +
        "**📋 Cómo hacerlo**\n" +
        "1️⃣ Presiona el botón **Verificarme**.\n" +
        "2️⃣ Escribe tu nombre y tu ID.\n" +
        "3️⃣ Recibirás tu rol y tu apodo automáticamente.\n\n" +
        "**⚠️ Importante**\n" +
        "• Cada **ID es único**: si ya está registrado por otra persona, no podrás usarlo.\n" +
        "• Escribe tus datos correctamente, no se pueden repetir.\n" +
        "• Si tienes un problema, abre un ticket con el staff."
    )
    .setFooter({ text: "Demon Racing • Verificación", iconURL: guild.iconURL() || undefined })
    .setTimestamp();
}

// Devuelve true si la interacción era de verificación (ya se atendió)
async function manejarVerificacion(interaction) {
  // ---------- /panel-verificacion ----------
  if (interaction.isChatInputCommand() && interaction.commandName === "panel-verificacion") {
    if (!esStaffVerif(interaction.member)) {
      await interaction.reply({ content: "❌ Solo el staff puede publicar este panel.", ephemeral: true });
      return true;
    }

    for (const rolId of ROLES_VERIFICADOS_IDS) {
      const rol = await interaction.guild.roles.fetch(rolId).catch(() => null);
      if (!rol) {
        await interaction.reply({
          content: `❌ No encuentro el rol de verificación (ID: \`${rolId}\`). Revisa \`ROLES_VERIFICADOS_IDS\` en el código.`,
          ephemeral: true,
        });
        return true;
      }
      if (rol.position >= interaction.guild.members.me.roles.highest.position) {
        await interaction.reply({
          content: `❌ Mi rol está por debajo de "${rol.name}". Sube mi rol por encima en Ajustes del servidor → Roles.`,
          ephemeral: true,
        });
        return true;
      }
    }

    const boton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("verificarme_btn")
        .setLabel("Verificarme")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success)
    );

    await interaction.reply({ embeds: [crearEmbedPanelVerificacion(interaction.guild)], components: [boton] });
    return true;
  }

  // ---------- Botón: Verificarme ----------
  if (interaction.isButton() && interaction.customId === "verificarme_btn") {
    const registro = buscarPorUsuario(interaction.user.id);
    if (registro) {
      await interaction.reply({
        content: `✅ Ya estás verificado como **${registro.nombre}** (ID: \`${registro.id}\`).`,
        ephemeral: true,
      });
      return true;
    }

    const modal = new ModalBuilder().setCustomId("modal_verificacion").setTitle("Verificación");

    const inputNombre = new TextInputBuilder()
      .setCustomId("input_nombre_verif")
      .setLabel("Nombre (ej: Santana)")
      .setStyle(TextInputStyle.Short)
      .setMinLength(2)
      .setMaxLength(20)
      .setRequired(true);

    const inputId = new TextInputBuilder()
      .setCustomId("input_id_verif")
      .setLabel("ID (ej: 25366)")
      .setStyle(TextInputStyle.Short)
      .setMaxLength(10)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(inputNombre),
      new ActionRowBuilder().addComponents(inputId)
    );

    await interaction.showModal(modal);
    return true;
  }

  // ---------- Modal enviado ----------
  if (interaction.isModalSubmit() && interaction.customId === "modal_verificacion") {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const userId = interaction.user.id;
    const nombre = interaction.fields.getTextInputValue("input_nombre_verif").trim().replace(/\s+/g, " ");
    const id = limpiarId(interaction.fields.getTextInputValue("input_id_verif"));

    // 1) Formato del ID
    if (!idValido(id)) {
      await interaction.editReply({ content: "❌ El ID solo puede tener **números** (máximo 10 dígitos)." });
      return true;
    }

    // 2) La persona ya está verificada
    const propio = buscarPorUsuario(userId);
    if (propio) {
      await interaction.editReply({
        content: `✅ Ya estás verificado como **${propio.nombre}** (ID: \`${propio.id}\`).`,
      });
      return true;
    }

    // 3) ID repetido → bloquear
    const existente = datosVerif.verificados[id];
    if (existente && existente.userId !== userId) {
      await interaction.editReply({
        content:
          `🚫 El ID \`${id}\` **ya está registrado por otra persona**.\n` +
          "Si es tuyo y crees que es un error, abre un ticket con el staff.",
      });

      await logVerificacion(
        guild,
        new EmbedBuilder()
          .setColor(COLOR_AVISO)
          .setTitle("⚠️ Intento de ID repetido")
          .setDescription(
            `<@${userId}> intentó verificarse con el ID \`${id}\`, que ya pertenece a <@${existente.userId}> (**${existente.nombre}**).`
          )
          .setTimestamp()
      );
      return true;
    }

    // 4) Registrar
    datosVerif.verificados[id] = { userId, nombre, fecha: Date.now(), origen: "bot" };
    guardarVerificaciones();

    // 5) Roles + apodo
    const member = await guild.members.fetch(userId).catch(() => null);
    let avisoExtra = "";
    if (member) {
      try {
        await member.roles.add(ROLES_VERIFICADOS_IDS);
        if (ROL_SIN_VERIFICAR_ID) await member.roles.remove(ROL_SIN_VERIFICAR_ID).catch(() => {});
      } catch (e) {
        console.error("No se pudo asignar el rol verificado:", e);
        avisoExtra += "\n⚠️ No pude darte el rol, avisa al staff.";
      }
      await member.setNickname(`${nombre} | ${id}`.slice(0, 32), "Verificación").catch(() => {
        avisoExtra += "\nℹ️ No pude cambiarte el apodo (probablemente por jerarquía de roles).";
      });
    }

    const embedOk = new EmbedBuilder()
      .setColor(COLOR_OK)
      .setTitle("✅ ¡Verificación completada!")
      .addFields(
        { name: "Nombre", value: `**${nombre}**`, inline: true },
        { name: "ID", value: `**${id}**`, inline: true }
      )
      .setDescription("Ya tienes acceso al servidor. ¡Bienvenido a **Demon Racing**! 🏁" + avisoExtra)
      .setTimestamp();

    await interaction.editReply({ embeds: [embedOk] });

    await logVerificacion(
      guild,
      new EmbedBuilder()
        .setColor(COLOR_OK)
        .setTitle("🟢 Nueva verificación")
        .setDescription(`<@${userId}> se verificó como **${nombre}** con el ID \`${id}\`.`)
        .setTimestamp()
    );
    return true;
  }

  // ---------- /sincronizar-verificados ----------
  if (interaction.isChatInputCommand() && interaction.commandName === "sincronizar-verificados") {
    if (!esStaffVerif(interaction.member)) {
      await interaction.reply({ content: "❌ Solo el staff puede usar este comando.", ephemeral: true });
      return true;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const miembros = await interaction.guild.members.fetch();

      const registrados = [];
      const pendientes = [];
      const duplicados = [];
      let yaEnBot = 0;
      let sinVerificar = 0;

      for (const m of miembros.values()) {
        if (m.user.bot) continue;

        if (!ROLES_VERIFICADOS_IDS.some((r) => m.roles.cache.has(r))) {
          sinVerificar++;
          continue;
        }

        if (buscarPorUsuario(m.id)) {
          yaEnBot++;
          continue;
        }

        const id = extraerIdDeApodo(m.displayName);
        if (!id) {
          pendientes.push(`<@${m.id}>`);
          continue;
        }

        if (datosVerif.verificados[id]) {
          duplicados.push(`<@${m.id}> → ID \`${id}\` (ya es de <@${datosVerif.verificados[id].userId}>)`);
          continue;
        }

        const nombre = m.displayName.replace(/[|\d]/g, "").trim().slice(0, 20) || m.user.username;
        datosVerif.verificados[id] = { userId: m.id, nombre, fecha: Date.now(), origen: "sincronizado" };
        registrados.push(`<@${m.id}> → **${nombre}** (\`${id}\`)`);
      }

      guardarVerificaciones();

      const embed = new EmbedBuilder()
        .setColor(COLOR_PRINCIPAL)
        .setTitle("🔄 Sincronización de verificados")
        .setDescription(
          "El bot revisó a los miembros con algún rol de verificación que aún no estaban en su base de datos.\n" +
            "El ID se toma del **apodo** (ej: `Santana | 25366`)."
        )
        .addFields(
          { name: `✅ Reconocidos ahora (${registrados.length})`, value: recortarLista(registrados) },
          {
            name: `❓ Con rol pero sin ID en el apodo (${pendientes.length})`,
            value:
              recortarLista(pendientes) +
              (pendientes.length ? "\n*Pueden usar el botón de verificación para registrar su ID.*" : ""),
          },
          { name: `🚫 ID repetido (${duplicados.length})`, value: recortarLista(duplicados) },
          { name: "📊 Resumen", value: `Ya registrados: **${yaEnBot}**\nSin verificar (sin rol): **${sinVerificar}**` }
        )
        .setFooter({ text: "Demon Racing • Verificación" })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (e) {
      console.error("Error en /sincronizar-verificados:", e);
      await interaction.editReply({
        content: `❌ No pude sincronizar. Revisa que el bot tenga el intent de **Server Members** activado. (${e.message})`,
      });
    }
    return true;
  }

  // ---------- /desverificar ----------
  if (interaction.isChatInputCommand() && interaction.commandName === "desverificar") {
    if (!esStaffVerif(interaction.member)) {
      await interaction.reply({ content: "❌ Solo el staff puede usar este comando.", ephemeral: true });
      return true;
    }

    const usuario = interaction.options.getUser("usuario");
    const registro = buscarPorUsuario(usuario.id);
    if (!registro) {
      await interaction.reply({ content: `⚠️ <@${usuario.id}> no está registrado en el bot.`, ephemeral: true });
      return true;
    }

    delete datosVerif.verificados[registro.id];
    guardarVerificaciones();

    const member = await interaction.guild.members.fetch(usuario.id).catch(() => null);
    if (member) {
      await member.roles.remove(ROLES_VERIFICADOS_IDS).catch(() => {});
      if (ROL_SIN_VERIFICAR_ID) await member.roles.add(ROL_SIN_VERIFICAR_ID).catch(() => {});
    }

    await interaction.reply({
      content: `🧹 <@${usuario.id}> fue desverificado. El ID \`${registro.id}\` quedó libre.`,
      ephemeral: true,
    });
    return true;
  }

  // ---------- /buscar-id ----------
  if (interaction.isChatInputCommand() && interaction.commandName === "buscar-id") {
    if (!esStaffVerif(interaction.member)) {
      await interaction.reply({ content: "❌ Solo el staff puede usar este comando.", ephemeral: true });
      return true;
    }

    const id = limpiarId(interaction.options.getString("id"));
    const registro = datosVerif.verificados[id];
    if (!registro) {
      await interaction.reply({ content: `🔎 El ID \`${id}\` **no está registrado**.`, ephemeral: true });
      return true;
    }

    const embed = new EmbedBuilder()
      .setColor(COLOR_PRINCIPAL)
      .setTitle("🔎 ID encontrado")
      .addFields(
        { name: "ID", value: `**${id}**`, inline: true },
        { name: "Nombre", value: `**${registro.nombre}**`, inline: true },
        { name: "Persona", value: `<@${registro.userId}>`, inline: true },
        { name: "Registrado", value: `<t:${Math.floor(registro.fecha / 1000)}:R>`, inline: true },
        { name: "Origen", value: registro.origen === "bot" ? "Verificó con el bot" : "Sincronizado", inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return true;
  }

  return false;
}

// ================== COMANDOS SLASH ==================
const comandos = [
  new SlashCommandBuilder()
    .setName("panel-enviar")
    .setDescription("Publica el panel para enviar mensajes a un canal"),

  new SlashCommandBuilder()
    .setName("limpiar")
    .setDescription("Borra varios mensajes recientes de este canal")
    .addIntegerOption((op) =>
      op
        .setName("cantidad")
        .setDescription("Cuántos mensajes borrar (1-100)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("reiniciar-canal")
    .setDescription("Borra TODOS los mensajes del canal actual clonándolo de nuevo")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("panel-tickets")
    .setDescription("Publica el panel para abrir tickets"),

  new SlashCommandBuilder()
    .setName("close")
    .setDescription("Cierra el ticket actual"),

  new SlashCommandBuilder()
    .setName("add")
    .setDescription("Agrega a alguien a este ticket")
    .addUserOption((op) =>
      op.setName("usuario").setDescription("Usuario a agregar").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("panel-servicios")
    .setDescription("Publica el panel para entrar a servicio"),

  new SlashCommandBuilder()
    .setName("total")
    .setDescription("Suma todos los totales de este canal"),

  new SlashCommandBuilder()
    .setName("dividir")
    .setDescription("Suma los totales de este canal y calcula cuánto generó según su porcentaje")
    .addNumberOption((op) =>
      op
        .setName("porcentaje")
        .setDescription("Su porcentaje por rol. Ej: 0.25 o 25")
        .setRequired(true)
        .setMinValue(0)
    ),

  new SlashCommandBuilder()
    .setName("panel-fichajes")
    .setDescription("Publica el panel para crear canales de fichajes")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("crear-categoria")
    .setDescription("Crea una categoría nueva")
    .addStringOption((op) =>
      op
        .setName("nombre")
        .setDescription("Nombre de la categoría")
        .setRequired(true)
        .setMaxLength(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("crear-canal")
    .setDescription("Crea un canal y/o una categoría")
    .addStringOption((op) =>
      op
        .setName("nombre")
        .setDescription("Nombre del canal (opcional)")
        .setMaxLength(100)
    )
    .addStringOption((op) =>
      op
        .setName("tipo")
        .setDescription("Texto o voz (por defecto texto)")
        .addChoices({ name: "Texto", value: "texto" }, { name: "Voz", value: "voz" })
    )
    .addStringOption((op) =>
      op
        .setName("categoria")
        .setDescription("Nombre de la categoría (si no existe, se crea)")
        .setMaxLength(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("limpiar-total")
    .setDescription("Limpia la Tabla de Facturas (a todos o a una persona) cuando van a cobrar")
    .addUserOption((op) =>
      op.setName("usuario").setDescription("Solo limpiar a esta persona (vacío = limpiar a todos)")
    ),

  new SlashCommandBuilder()
    .setName("cobrar-todos")
    .setDescription("Factura de cobro de todos con el porcentaje general (25%)"),

  new SlashCommandBuilder()
    .setName("cobrar-persona")
    .setDescription("Factura de cobro de una persona con su propio porcentaje")
    .addUserOption((op) =>
      op.setName("usuario").setDescription("Persona a cobrar").setRequired(true)
    )
    .addNumberOption((op) =>
      op
        .setName("porcentaje")
        .setDescription("Su porcentaje. Ej: 0.30 o 30")
        .setRequired(true)
        .setMinValue(0)
    ),

  // ---- Verificación ----
  new SlashCommandBuilder()
    .setName("panel-verificacion")
    .setDescription("Publica el panel de verificación en este canal")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName("sincronizar-verificados")
    .setDescription("Reconoce a los miembros que ya tienen el rol verificado pero no pasaron por el bot")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName("desverificar")
    .setDescription("Libera el ID de una persona para que pueda verificarse de nuevo")
    .addUserOption((op) => op.setName("usuario").setDescription("Persona a desverificar").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName("buscar-id")
    .setDescription("Busca quién tiene registrado un ID")
    .addStringOption((op) => op.setName("id").setDescription("ID a buscar").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
].map((c) => c.toJSON());

async function registrarComandos() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: comandos,
  });
  console.log("Comandos registrados correctamente.");
}

client.once("ready", async () => {
  console.log(`Bot conectado como ${client.user.tag}`);
  await registrarComandos();

  // Cargar la tabla de facturas y publicarla/actualizarla al encender
  cargarFacturas();
  cargarVerificaciones();
  const guildTabla = await client.guilds.fetch(GUILD_ID).catch(() => null);
  if (guildTabla) pedirActualizacionTabla(guildTabla);

  // Restaurar servicios activos guardados (por si Railway reinició el bot)
  cargarServicios();
  const ahora = Date.now();
  for (const [key, entrada] of serviciosActivos.entries()) {
    const restante = entrada.fin - ahora;
    if (restante <= 0) {
      finalizarServicio(key, "tiempo");
    } else {
      programarFinServicio(key, restante);
    }
  }

  // Ranking de horas en servicio: carga, reinicio semanal y actualización cada 5 minutos
  cargarHoras();
  revisarSemana();
  const guildRanking = await client.guilds.fetch(GUILD_ID).catch(() => null);
  if (guildRanking) {
    pedirActualizacionRanking(guildRanking);
    setInterval(() => {
      revisarSemana();
      pedirActualizacionRanking(guildRanking);
    }, 5 * 60 * 1000);
  }
});

// ================== DESCONEXIÓN EN SERVICIO ==================
// Si alguien en servicio se desconecta / se pone invisible, se le quita el servicio
client.on("presenceUpdate", (oldPresence, newPresence) => {
  if (!newPresence || !newPresence.guild) return;
  if (newPresence.status !== "offline") return;

  const key = `${newPresence.guild.id}:${newPresence.userId}`;
  if (!serviciosActivos.has(key)) return;

  finalizarServicio(key, "desconexion");
});

// ================== INTERACCIONES ==================
client.on("interactionCreate", async (interaction) => {
  try {
    // ---------- Verificación (nombre + ID) ----------
    if (await manejarVerificacion(interaction)) return;

    // ---------- /panel-enviar ----------
    if (interaction.isChatInputCommand() && interaction.commandName === "panel-enviar") {
      const embed = new EmbedBuilder()
        .setTitle("Enviar mensaje")
        .setDescription("Pulsa el botón de abajo para elegir un canal y escribir un mensaje.")
        .setColor(0x5865f2);

      const boton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("abrir_enviar")
          .setLabel("Enviar mensaje")
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.reply({ embeds: [embed], components: [boton] });
      return;
    }

    // ---------- Botón: elegir canal ----------
    if (interaction.isButton() && interaction.customId === "abrir_enviar") {
      const selector = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId("seleccionar_canal_enviar")
          .setPlaceholder("Elige un canal")
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      );

      await interaction.reply({
        content: "Selecciona el canal donde se enviará el mensaje:",
        components: [selector],
        ephemeral: true,
      });
      return;
    }

    // ---------- Canal seleccionado: abrir modal para escribir el mensaje ----------
    if (interaction.isChannelSelectMenu() && interaction.customId === "seleccionar_canal_enviar") {
      const canalId = interaction.values[0];

      const modal = new ModalBuilder()
        .setCustomId(`modal_enviar:${canalId}`)
        .setTitle("Escribir mensaje");

      const inputTitulo = new TextInputBuilder()
        .setCustomId("input_titulo")
        .setLabel("Título (opcional)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(256);

      const inputMensaje = new TextInputBuilder()
        .setCustomId("input_mensaje")
        .setLabel("Mensaje a enviar")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(4000);

      modal.addComponents(
        new ActionRowBuilder().addComponents(inputTitulo),
        new ActionRowBuilder().addComponents(inputMensaje)
      );

      await interaction.showModal(modal);
      return;
    }

    // ---------- Modal de envío de mensaje enviado ----------
    if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_enviar:")) {
      const canalId = interaction.customId.split(":")[1];
      const titulo = interaction.fields.getTextInputValue("input_titulo")?.trim();
      const texto = interaction.fields.getTextInputValue("input_mensaje");

      const canal = await client.channels.fetch(canalId).catch(() => null);
      if (!canal || !canal.isTextBased()) {
        await interaction.reply({ content: "❌ No encuentro ese canal.", ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setDescription(texto)
        .setColor(0x5865f2)
        .setTimestamp();

      if (titulo) embed.setTitle(titulo);

      try {
        await canal.send({ embeds: [embed] });
        await interaction.reply({ content: `✅ Mensaje enviado a <#${canalId}>.`, ephemeral: true });
      } catch (e) {
        console.error(e);
        await interaction.reply({
          content: "❌ No pude enviar el mensaje. Revisa que el bot tenga permiso de escribir en ese canal.",
          ephemeral: true,
        });
      }
      return;
    }

    // ---------- /limpiar ----------
    if (interaction.isChatInputCommand() && interaction.commandName === "limpiar") {
      const cantidad = interaction.options.getInteger("cantidad");

      if (!interaction.channel || !interaction.channel.isTextBased()) {
        await interaction.reply({ content: "❌ Este canal no admite borrado de mensajes.", ephemeral: true });
        return;
      }

      try {
        const borrados = await interaction.channel.bulkDelete(cantidad, true);
        await interaction.reply({
          content: `🧹 Se borraron ${borrados.size} mensaje(s).`,
          ephemeral: true,
        });
      } catch (e) {
        console.error(e);
        await interaction.reply({
          content:
            "❌ No pude borrar los mensajes. Discord solo permite borrar en lote mensajes de menos de 14 días, y el bot necesita el permiso 'Gestionar mensajes'.",
          ephemeral: true,
        });
      }
      return;
    }

    // ---------- /reiniciar-canal ----------
    if (interaction.isChatInputCommand() && interaction.commandName === "reiniciar-canal") {
      const canalOriginal = interaction.channel;

      if (!canalOriginal || !canalOriginal.clone) {
        await interaction.reply({ content: "❌ Este canal no se puede reiniciar.", ephemeral: true });
        return;
      }

      try {
        await interaction.reply({ content: "🧹 Reiniciando el canal...", ephemeral: true });

        const posicion = canalOriginal.rawPosition;
        const nuevoCanal = await canalOriginal.clone();
        await nuevoCanal.setPosition(posicion).catch(() => {});
        await canalOriginal.delete("Reinicio de canal solicitado");

        await nuevoCanal.send("✅ Canal reiniciado. Todos los mensajes anteriores fueron borrados.");
      } catch (e) {
        console.error(e);
      }
      return;
    }

    // ---------- /panel-tickets ----------
    if (interaction.isChatInputCommand() && interaction.commandName === "panel-tickets") {
      try {
        // Verificar que la categoría de tickets existe antes de publicar el panel
        const categoria = await interaction.guild.channels.fetch(CATEGORIA_TICKETS_ID).catch(() => null);
        if (!categoria || categoria.type !== ChannelType.GuildCategory) {
          await interaction.reply({
            content: `❌ No encuentro la categoría de tickets (ID: \`${CATEGORIA_TICKETS_ID}\`). Verifica el ID de \`CATEGORIA_TICKETS_ID\` en el código.`,
            ephemeral: true,
          });
          return;
        }

        // Verificar que el bot puede crear canales en esa categoría
        const permisosBot = categoria.permissionsFor(interaction.guild.members.me);
        if (!permisosBot || !permisosBot.has(PermissionFlagsBits.ManageChannels)) {
          await interaction.reply({
            content: "❌ No tengo permiso de 'Gestionar canales' en la categoría de tickets. Dame ese permiso e intenta de nuevo.",
            ephemeral: true,
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("🎫 Sistema de Tickets")
          .setThumbnail(interaction.guild.iconURL({ size: 256 }) || null)
          .setDescription(
            "¿Necesitas ayuda? Elige una opción del menú de abajo y abre un ticket.\n" +
              "Un miembro del staff te atenderá lo antes posible.\n\n" +
              Object.values(TIPOS_TICKET)
                .map((t) => `${t.emoji} **${t.label}**\n${t.description}`)
                .join("\n\n") +
              "\n\n📌 **Antes de abrir un ticket**\n" +
              "• Solo puedes tener **un ticket abierto** a la vez.\n" +
              "• Sé respetuoso con el staff.\n" +
              "• No abras tickets falsos ni hagas spam."
          )
          .setFooter({ text: `${interaction.guild.name} • Soporte`, iconURL: interaction.guild.iconURL() || undefined })
          .setTimestamp();

        const menu = new StringSelectMenuBuilder()
          .setCustomId("seleccionar_tipo_ticket")
          .setPlaceholder("Elige una opción")
          .addOptions(
            Object.entries(TIPOS_TICKET).map(([id, t]) => ({
              label: t.label,
              description: t.description,
              value: id,
              emoji: t.emoji,
            }))
          );

        const fila = new ActionRowBuilder().addComponents(menu);

        await interaction.reply({ embeds: [embed], components: [fila] });
      } catch (e) {
        console.error("Error en /panel-tickets:", e);
        if (interaction.isRepliable() && !interaction.replied) {
          await interaction
            .reply({ content: `❌ Error al publicar el panel de tickets: ${e.message}`, ephemeral: true })
            .catch(() => {});
        }
      }
      return;
    }

    // ---------- Selección del tipo de ticket ----------
    if (interaction.isStringSelectMenu() && interaction.customId === "seleccionar_tipo_ticket") {
      try {
        const tipoId = interaction.values[0];
        const tipo = TIPOS_TICKET[tipoId];
        const guild = interaction.guild;

        const yaAbierto = guild.channels.cache.find(
          (c) => esCanalDeTicket(c) && c.topic.includes(`ticket:${interaction.user.id}:`)
        );
        if (yaAbierto) {
          await interaction.reply({
            content: `⚠️ Ya tienes un ticket abierto: <#${yaAbierto.id}>`,
            ephemeral: true,
          });
          return;
        }

        await interaction.deferReply({ ephemeral: true });

        const nombreCanal = `ticket-${interaction.user.username}`
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "")
          .slice(0, 90);

        const canalTicket = await guild.channels.create({
          name: nombreCanal || `ticket-${interaction.user.id}`,
          type: ChannelType.GuildText,
          parent: CATEGORIA_TICKETS_ID,
          topic: `ticket:${interaction.user.id}:${tipoId}`,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionFlagsBits.ViewChannel],
            },
            {
              id: interaction.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
              ],
            },
          ],
        });

        const embedTicket = new EmbedBuilder()
          .setTitle(`${tipo.emoji} ${tipo.label}`)
          .setDescription(`${tipo.mensaje}\n\n<@${interaction.user.id}>`)
          .setColor(0xed4245)
          .setFooter({ text: "Usa /close para cerrar · /add @usuario para agregar a alguien" });

        await canalTicket.send({ embeds: [embedTicket] });

        await interaction.editReply({
          content: `✅ Tu ticket fue creado: <#${canalTicket.id}>`,
        });
      } catch (e) {
        console.error("Error al crear el ticket:", e);
        if (interaction.deferred) {
          await interaction.editReply({ content: `❌ No pude crear el ticket: ${e.message}` }).catch(() => {});
        } else if (interaction.isRepliable()) {
          await interaction
            .reply({ content: `❌ No pude crear el ticket: ${e.message}`, ephemeral: true })
            .catch(() => {});
        }
      }
      return;
    }

    // ---------- /close ----------
    if (interaction.isChatInputCommand() && interaction.commandName === "close") {
      const canal = interaction.channel;

      if (!esCanalDeTicket(canal)) {
        await interaction.reply({ content: "❌ Este comando solo funciona dentro de un ticket.", ephemeral: true });
        return;
      }

      await interaction.reply("🔒 Cerrando este ticket en 5 segundos...");
      setTimeout(() => {
        canal.delete("Ticket cerrado").catch(() => {});
      }, 5000);
      return;
    }

    // ---------- /add ----------
    if (interaction.isChatInputCommand() && interaction.commandName === "add") {
      const canal = interaction.channel;

      if (!esCanalDeTicket(canal)) {
        await interaction.reply({ content: "❌ Este comando solo funciona dentro de un ticket.", ephemeral: true });
        return;
      }

      const usuario = interaction.options.getUser("usuario");

      await canal.permissionOverwrites.edit(usuario.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });

      const embedAdd = new EmbedBuilder()
        .setDescription(`➕ <@${usuario.id}> fue agregado al ticket.`)
        .setColor(0xed4245);

      await interaction.reply({ embeds: [embedAdd] });
      return;
    }

    // ---------- /panel-fichajes ----------
    if (interaction.isChatInputCommand() && interaction.commandName === "panel-fichajes") {
      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle("🛠️ Fichajes — Demon Racing")
        .setThumbnail(interaction.guild.iconURL({ size: 256 }) || null)
        .setDescription(
          "Presiona **Crear fichaje** para abrir el canal de fichajes de una persona.\n\n" +
            "👤 Primero eliges a la **persona**.\n" +
            "📝 Luego escribes su **nombre** y su **ID**.\n" +
            "📋 Cuando se cree el canal, ahí mismo se envía el formato que debe usar.\n\n" +
            "⚠️ Cada persona solo puede tener **un canal de fichajes** a la vez."
        )
        .setFooter({ text: "Demon Racing • Fichajes", iconURL: interaction.guild.iconURL() || undefined })
        .setTimestamp();

      const boton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("crear_fichaje_btn")
          .setLabel("Crear fichaje")
          .setEmoji("📋")
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({ embeds: [embed], components: [boton] });
      return;
    }

    // ---------- Botón: Crear fichaje (paso 1: elegir a la persona) ----------
    if (interaction.isButton() && interaction.customId === "crear_fichaje_btn") {
      if (!puedeCrearFichajes(interaction.member)) {
        await interaction.reply({ content: "❌ Solo el staff puede crear fichajes.", ephemeral: true });
        return;
      }

      const selector = new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId("seleccionar_usuario_fichaje")
          .setPlaceholder("Elige a la persona")
      );

      await interaction.reply({
        content: "Elige a la persona para quien es el canal de fichajes:",
        components: [selector],
        ephemeral: true,
      });
      return;
    }

    // ---------- Persona elegida (paso 2: nombre e ID) ----------
    if (interaction.isUserSelectMenu() && interaction.customId === "seleccionar_usuario_fichaje") {
      const userId = interaction.values[0];

      const yaExiste = interaction.guild.channels.cache.find((c) => c.topic === `fichaje:${userId}`);
      if (yaExiste) {
        await interaction.update({
          content: `⚠️ <@${userId}> ya tiene un canal de fichajes: <#${yaExiste.id}>`,
          components: [],
        });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(`modal_crear_fichaje:${userId}`)
        .setTitle("Crear fichaje");

      const inputNombre = new TextInputBuilder()
        .setCustomId("input_nombre_fichaje")
        .setLabel("Nombre (ej: Santana)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(40);

      const inputId = new TextInputBuilder()
        .setCustomId("input_id_fichaje")
        .setLabel("ID (ej: 25366)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(15);

      modal.addComponents(
        new ActionRowBuilder().addComponents(inputNombre),
        new ActionRowBuilder().addComponents(inputId)
      );

      await interaction.showModal(modal);
      return;
    }

    // ---------- Modal: Crear fichaje enviado (paso 3: crear el canal) ----------
    if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_crear_fichaje:")) {
      try {
        const guild = interaction.guild;
        const userId = interaction.customId.split(":")[1];
        const nombre = interaction.fields.getTextInputValue("input_nombre_fichaje").trim();
        const idJugador = interaction.fields.getTextInputValue("input_id_fichaje").trim();

        await interaction.deferReply({ ephemeral: true });

        if (!puedeCrearFichajes(interaction.member)) {
          await interaction.editReply({ content: "❌ Solo el staff puede crear fichajes." });
          return;
        }

        const persona = await guild.members.fetch(userId).catch(() => null);
        if (!persona) {
          await interaction.editReply({ content: "❌ No encuentro a esa persona en el servidor." });
          return;
        }

        const yaExiste = guild.channels.cache.find((c) => c.topic === `fichaje:${userId}`);
        if (yaExiste) {
          await interaction.editReply({ content: `⚠️ <@${userId}> ya tiene un canal de fichajes: <#${yaExiste.id}>` });
          return;
        }

        const categoria = await buscarCategoriaFichajes(guild);
        if (!categoria) {
          await interaction.editReply({
            content:
              '❌ No encuentro la categoría "Control de Personal". Ponle ese nombre a la categoría o escribe su ID en `CATEGORIA_FICHAJES_ID` en el código.',
          });
          return;
        }

        const nombreCanal = `fichaje-dr-${limpiarParaCanal(nombre) || "sin-nombre"}-id-${
          limpiarParaCanal(idJugador) || "0"
        }`.slice(0, 100);

        const canal = await guild.channels.create({
          name: nombreCanal,
          type: ChannelType.GuildText,
          parent: categoria.id,
          topic: `fichaje:${userId}`,
          // Privado: solo lo ven los roles del staff, el bot y la persona elegida
          permissionOverwrites: permisosPrivados(guild, [userId]),
        });

        // Botón para cerrar (borrar) el canal completo
        const botonCerrar = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("cerrar_fichaje_btn")
            .setLabel("Cerrar fichaje")
            .setEmoji("🔒")
            .setStyle(ButtonStyle.Danger)
        );

        await canal.send({
          content: "@everyone",
          embeds: [crearEmbedFormatoFichajes(guild)],
          components: [botonCerrar],
          allowedMentions: { parse: ["everyone"] },
        });

        await interaction.editReply({ content: `✅ Canal de fichajes creado para <@${userId}>: <#${canal.id}>` });
      } catch (e) {
        console.error("Error al crear el fichaje:", e);
        if (interaction.deferred) {
          await interaction.editReply({ content: `❌ No pude crear el canal: ${e.message}` }).catch(() => {});
        } else if (interaction.isRepliable()) {
          await interaction
            .reply({ content: `❌ No pude crear el canal: ${e.message}`, ephemeral: true })
            .catch(() => {});
        }
      }
      return;
    }

    // ---------- Botón: Cerrar fichaje ----------
    if (interaction.isButton() && interaction.customId === "cerrar_fichaje_btn") {
      const canal = interaction.channel;

      if (!canal.topic || !canal.topic.startsWith("fichaje:")) {
        await interaction.reply({ content: "❌ Este botón solo funciona dentro de un canal de fichajes.", ephemeral: true });
        return;
      }

      if (!puedeCrearFichajes(interaction.member)) {
        await interaction.reply({ content: "❌ Solo el staff puede cerrar fichajes.", ephemeral: true });
        return;
      }

      await interaction.reply("🔒 Cerrando este fichaje en 5 segundos...");
      setTimeout(() => {
        canal.delete(`Fichaje cerrado por ${interaction.user.tag}`).catch(() => {});
      }, 5000);
      return;
    }

    // ---------- /crear-categoria ----------
    if (interaction.isChatInputCommand() && interaction.commandName === "crear-categoria") {
      const nombre = interaction.options.getString("nombre").trim();
      await interaction.deferReply({ ephemeral: true });

      try {
        const categoria = await interaction.guild.channels.create({
          name: nombre,
          type: ChannelType.GuildCategory,
        });
        await interaction.editReply(`✅ Categoría creada: **${categoria.name}**`);
      } catch (e) {
        console.error("Error en /crear-categoria:", e);
        await interaction.editReply(
          `❌ No pude crear la categoría. Revisa que el bot tenga el permiso 'Gestionar canales'. (${e.message})`
        );
      }
      return;
    }

    // ---------- /crear-canal ----------
    if (interaction.isChatInputCommand() && interaction.commandName === "crear-canal") {
      const nombre = interaction.options.getString("nombre")?.trim();
      const tipo = interaction.options.getString("tipo") ?? "texto";
      const nombreCategoria = interaction.options.getString("categoria")?.trim();
      const nombreCanal = nombre;

      if (!nombreCanal && !nombreCategoria) {
        await interaction.reply({
          content: "⚠️ Escribe al menos el nombre del canal o el nombre de la categoría.",
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      try {
        let categoria = null;
        let categoriaCreada = false;

        if (nombreCategoria) {
          await interaction.guild.channels.fetch().catch(() => {});
          categoria =
            interaction.guild.channels.cache.find(
              (c) =>
                c.type === ChannelType.GuildCategory &&
                normalizarTexto(c.name) === normalizarTexto(nombreCategoria)
            ) ?? null;

          if (!categoria) {
            categoria = await interaction.guild.channels.create({
              name: nombreCategoria,
              type: ChannelType.GuildCategory,
            });
            categoriaCreada = true;
          }
        }

        if (!nombreCanal) {
          await interaction.editReply(
            categoriaCreada
              ? `✅ Categoría creada: **${categoria.name}**`
              : `ℹ️ La categoría **${categoria.name}** ya existía.`
          );
          return;
        }

        const canal = await interaction.guild.channels.create({
          name: nombreCanal,
          type: tipo === "voz" ? ChannelType.GuildVoice : ChannelType.GuildText,
          parent: categoria ? categoria.id : undefined,
        });

        await interaction.editReply(
          `✅ Canal ${tipo === "voz" ? "de voz" : "de texto"} creado: <#${canal.id}>` +
            (categoria
              ? ` en **${categoria.name}**${categoriaCreada ? " (la categoría no existía, la creé)" : ""}`
              : "")
        );
      } catch (e) {
        console.error("Error en /crear-canal:", e);
        await interaction.editReply(
          `❌ No pude crear el canal. Revisa que el bot tenga el permiso 'Gestionar canales'. (${e.message})`
        );
      }
      return;
    }

    // ---------- /total ----------
    if (interaction.isChatInputCommand() && interaction.commandName === "total") {
      await interaction.deferReply();

      try {
        const total = await calcularTotalFichajes(interaction.channel, 1000, null);
        await interaction.editReply(`💰 Total: **${total.toLocaleString("en-US")}**`);
      } catch (e) {
        console.error("Error en /total:", e);
        await interaction.editReply(
          "❌ No pude leer los mensajes. Revisa que el bot tenga permiso de ver el canal y leer el historial."
        );
      }
      return;
    }

    // ---------- /dividir ----------
    if (interaction.isChatInputCommand() && interaction.commandName === "dividir") {
      let porcentaje = interaction.options.getNumber("porcentaje");
      if (porcentaje > 1) porcentaje = porcentaje / 100; // 25 -> 0.25

      await interaction.deferReply();

      try {
        const total = await calcularTotalFichajes(interaction.channel, 1000, null);
        const generado = Math.round(total * porcentaje);
        await interaction.editReply(`💵 Generó: **${generado.toLocaleString("en-US")}**`);
      } catch (e) {
        console.error("Error en /dividir:", e);
        await interaction.editReply(
          "❌ No pude leer los mensajes. Revisa que el bot tenga permiso de ver el canal y leer el historial."
        );
      }
      return;
    }

    // ---------- /limpiar-total ----------
    if (interaction.isChatInputCommand() && interaction.commandName === "limpiar-total") {
      if (!puedeCrearFichajes(interaction.member)) {
        await interaction.reply({ content: "❌ Solo el staff puede limpiar los totales.", ephemeral: true });
        return;
      }

      const usuario = interaction.options.getUser("usuario");
      let texto;

      if (usuario) {
        if (!datosFacturas.empleados[usuario.id]) {
          await interaction.reply({ content: `⚠️ <@${usuario.id}> no tiene facturas en la tabla.`, ephemeral: true });
          return;
        }
        delete datosFacturas.empleados[usuario.id];
        texto = `🧹 Se limpió el total de <@${usuario.id}>.`;
      } else {
        datosFacturas.empleados = {};
        texto = "🧹 Se limpió toda la Tabla de Facturas.";
      }

      guardarFacturas();
      pedirActualizacionTabla(interaction.guild);
      await interaction.reply({ content: texto, ephemeral: true });
      return;
    }

    // ---------- /cobrar-todos ----------
    if (interaction.isChatInputCommand() && interaction.commandName === "cobrar-todos") {
      if (!puedeCrearFichajes(interaction.member)) {
        await interaction.reply({ content: "❌ Solo el staff puede sacar la factura de todos.", ephemeral: true });
        return;
      }

      const lista = Object.values(datosFacturas.empleados)
        .filter((e) => e.total > 0)
        .sort((a, b) => b.total - a.total)
        .map((e) => ({
          nombre: e.nombre,
          total: e.total,
          aCobrar: Math.round(e.total * PORCENTAJE_GENERAL),
        }));

      if (lista.length === 0) {
        await interaction.reply({ content: "⚠️ No hay facturas en la tabla.", ephemeral: true });
        return;
      }

      const anchoNombre = Math.max(8, ...lista.map((x) => x.nombre.length));
      const anchoTotal = Math.max(5, ...lista.map((x) => formatoDinero(x.total).length));
      const anchoCobro = Math.max(8, ...lista.map((x) => formatoDinero(x.aCobrar).length));

      const encabezado = `${"EMPLEADO".padEnd(anchoNombre)} | ${"TOTAL".padStart(anchoTotal)} | ${"A COBRAR".padStart(anchoCobro)}`;
      const linea = "-".repeat(encabezado.length);
      const filas = lista.map(
        (x) =>
          `${x.nombre.padEnd(anchoNombre)} | ${formatoDinero(x.total).padStart(anchoTotal)} | ${formatoDinero(x.aCobrar).padStart(anchoCobro)}`
      );

      const totalGenerado = lista.reduce((s, x) => s + x.total, 0);
      const totalCobrar = lista.reduce((s, x) => s + x.aCobrar, 0);

      const embedTodos = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle(`🧾 Factura de cobro (${textoPorcentaje(PORCENTAJE_GENERAL)})`)
        .setDescription("```\n" + [encabezado, linea, ...filas].join("\n") + "\n```")
        .addFields(
          { name: "Total generado", value: `**${formatoDinero(totalGenerado)}**`, inline: true },
          { name: "💵 Total a cobrar", value: `**${formatoDinero(totalCobrar)}**`, inline: true }
        )
        .setFooter({ text: "Demon Racing • Cobros", iconURL: interaction.guild.iconURL() || undefined })
        .setTimestamp();

      await interaction.reply({ embeds: [embedTodos] });
      return;
    }

    // ---------- /cobrar-persona ----------
    if (interaction.isChatInputCommand() && interaction.commandName === "cobrar-persona") {
      if (!puedeCrearFichajes(interaction.member)) {
        await interaction.reply({ content: "❌ Solo el staff puede sacar esta factura.", ephemeral: true });
        return;
      }

      const usuario = interaction.options.getUser("usuario");
      const porcentaje = normalizarPorcentaje(interaction.options.getNumber("porcentaje"));

      const emp = datosFacturas.empleados[usuario.id];
      if (!emp || emp.total <= 0) {
        await interaction.reply({ content: `⚠️ <@${usuario.id}> no tiene facturas en la tabla.`, ephemeral: true });
        return;
      }

      const aCobrar = Math.round(emp.total * porcentaje);

      const embedUno = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("🧾 Factura de cobro")
        .addFields(
          { name: "Empleado", value: `<@${usuario.id}>`, inline: true },
          { name: "Facturas", value: `**${emp.facturas}**`, inline: true },
          { name: "Total generado", value: `**${formatoDinero(emp.total)}**`, inline: true },
          { name: "Porcentaje", value: `**${textoPorcentaje(porcentaje)}**`, inline: true },
          { name: "💵 A cobrar", value: `**${formatoDinero(aCobrar)}**`, inline: true }
        )
        .setFooter({ text: "Demon Racing • Cobros", iconURL: interaction.guild.iconURL() || undefined })
        .setTimestamp();

      await interaction.reply({ embeds: [embedUno] });
      return;
    }

    // ---------- /panel-servicios ----------
    if (interaction.isChatInputCommand() && interaction.commandName === "panel-servicios") {
      try {
        // Verificar que el rol de servicio existe
        const rolServicio = await interaction.guild.roles.fetch(ROL_SERVICIO_ID).catch(() => null);
        if (!rolServicio) {
          await interaction.reply({
            content: `❌ No encuentro el rol de servicio (ID: \`${ROL_SERVICIO_ID}\`). Verifica el ID de \`ROL_SERVICIO_ID\` en el código.`,
            ephemeral: true,
          });
          return;
        }

        // Verificar que el rol del bot está por encima del rol de servicio
        if (rolServicio.position >= interaction.guild.members.me.roles.highest.position) {
          await interaction.reply({
            content: `❌ Mi rol está por debajo de "${rolServicio.name}" en la jerarquía. Sube mi rol por encima de ese rol en Ajustes del servidor → Roles.`,
            ephemeral: true,
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle(`🕒 Panel de Servicio — ${interaction.guild.name}`)
          .setThumbnail(interaction.guild.iconURL({ size: 256 }) || null)
          .setDescription(
            `⏱️ Presiona **Entrar en Servicio** e indica cuántos minutos estarás de turno (entre 1 y 120).\n\n` +
              `🔒 Mientras estés en servicio se te asignará el rol <@&${ROL_SERVICIO_ID}>.\n\n` +
              `🔴 Presiona **Salir de Turno** en cualquier momento para finalizar tu servicio antes de que se acabe el tiempo.`
          )
          .setFooter({ text: `${interaction.guild.name} • Servicios`, iconURL: interaction.guild.iconURL() || undefined })
          .setTimestamp();

        const botones = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("entrar_servicio_btn")
            .setLabel("Entrar en Servicio")
            .setEmoji("🟢")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("salir_servicio_btn")
            .setLabel("Salir de Turno")
            .setEmoji("🔴")
            .setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({ embeds: [embed], components: [botones] });
      } catch (e) {
        console.error("Error en /panel-servicios:", e);
        if (interaction.isRepliable() && !interaction.replied) {
          await interaction
            .reply({ content: `❌ Error al publicar el panel de servicios: ${e.message}`, ephemeral: true })
            .catch(() => {});
        }
      }
      return;
    }

    // ---------- Botón: Entrar en Servicio ----------
    if (interaction.isButton() && interaction.customId === "entrar_servicio_btn") {
      const key = `${interaction.guild.id}:${interaction.user.id}`;
      const entradaActiva = serviciosActivos.get(key);

      if (entradaActiva) {
        await interaction.reply({
          content: `⚠️ Ya estás en servicio. Termina <t:${Math.floor(entradaActiva.fin / 1000)}:R>.`,
          ephemeral: true,
        });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId("modal_entrar_servicio")
        .setTitle("Entrar en Servicio");

      const inputMinutos = new TextInputBuilder()
        .setCustomId("input_minutos_servicio")
        .setLabel("Minutos de turno (1-120)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ej: 60")
        .setRequired(true)
        .setMaxLength(3);

      modal.addComponents(new ActionRowBuilder().addComponents(inputMinutos));

      await interaction.showModal(modal);
      return;
    }

    // ---------- Modal: Entrar en Servicio enviado ----------
    if (interaction.isModalSubmit() && interaction.customId === "modal_entrar_servicio") {
      try {
        const key = `${interaction.guild.id}:${interaction.user.id}`;

        if (serviciosActivos.has(key)) {
          await interaction.reply({ content: "⚠️ Ya estás en servicio.", ephemeral: true });
          return;
        }

        const texto = interaction.fields.getTextInputValue("input_minutos_servicio").trim();
        const minutos = parseInt(texto, 10);

        if (isNaN(minutos) || minutos < 1 || minutos > 120) {
          await interaction.reply({
            content: "❌ Escribe un número de minutos válido entre 1 y 120.",
            ephemeral: true,
          });
          return;
        }

        await interaction.deferReply({ ephemeral: true });

        const entrada = await iniciarServicio(interaction, minutos);
        if (!entrada) {
          await interaction.editReply({ content: "❌ No pude asignarte el rol de servicio." });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle("🟢 En servicio")
          .setDescription(
            `Entraste a servicio por **${minutos} minuto${minutos > 1 ? "s" : ""}**.\nTermina <t:${Math.floor(
              entrada.fin / 1000
            )}:F> (<t:${Math.floor(entrada.fin / 1000)}:R>).`
          )
          .setColor(0x57f287);

        const botonSalir = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("salir_servicio_btn")
            .setLabel("Salir de Turno")
            .setEmoji("🔴")
            .setStyle(ButtonStyle.Danger)
        );

        await interaction.editReply({ embeds: [embed], components: [botonSalir] });
      } catch (e) {
        console.error("Error al iniciar servicio:", e);
        if (interaction.deferred) {
          await interaction.editReply({ content: `❌ No pude iniciar el servicio: ${e.message}` }).catch(() => {});
        } else if (interaction.isRepliable()) {
          await interaction
            .reply({ content: `❌ No pude iniciar el servicio: ${e.message}`, ephemeral: true })
            .catch(() => {});
        }
      }
      return;
    }

    // ---------- Botón: Salir de Turno ----------
    if (interaction.isButton() && interaction.customId === "salir_servicio_btn") {
      const key = `${interaction.guild.id}:${interaction.user.id}`;

      if (!serviciosActivos.has(key)) {
        await interaction.reply({ content: "⚠️ No estás en servicio actualmente.", ephemeral: true });
        return;
      }

      await interaction.deferReply({ ephemeral: true });
      await finalizarServicio(key, "manual");
      await interaction.editReply({ content: "🔴 Saliste de servicio. Se te quitó el rol." });
      return;
    }
  } catch (error) {
    console.error("Error en la interacción:", error);
    if (interaction.isRepliable()) {
      await interaction
        .reply({ content: "⚠️ Ocurrió un error al procesar la solicitud.", ephemeral: true })
        .catch(() => {});
    }
  }
});

client.login(TOKEN);