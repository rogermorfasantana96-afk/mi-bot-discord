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
const CANAL_LOGS_SERVICIO_ID = ""; // opcional: pon aquí el ID de un canal de texto para registrar entradas/salidas. Déjalo vacío ("") si no quieres logs.
const ARCHIVO_SERVICIOS = "./servicios_activos.json";

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

  await logServicio(interaction.guild, `🟢 <@${userId}> **entró** a servicio por **${minutos} minuto(s)**. Termina <t:${Math.floor(fin / 1000)}:R>.`);

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
  if (member) {
    await member.roles.remove(ROL_SERVICIO_ID).catch((e) => {
      console.error("No se pudo quitar el rol de servicio:", e);
    });
  }

  const texto =
    motivo === "manual"
      ? `🔴 <@${userId}> **salió** de servicio manualmente.`
      : `⏰ Se cumplió el tiempo de servicio de <@${userId}>, el rol fue removido.`;

  await logServicio(guild, texto);
}

async function logServicio(guild, texto) {
  if (!CANAL_LOGS_SERVICIO_ID) return;
  const canal = await guild.channels.fetch(CANAL_LOGS_SERVICIO_ID).catch(() => null);
  if (!canal || !canal.isTextBased()) return;

  const embed = new EmbedBuilder().setDescription(texto).setColor(0x57f287).setTimestamp();
  await canal.send({ embeds: [embed] }).catch(() => {});
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
});

// ================== INTERACCIONES ==================
client.on("interactionCreate", async (interaction) => {
  try {
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