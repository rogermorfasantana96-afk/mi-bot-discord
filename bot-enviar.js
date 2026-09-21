require("dotenv").config();
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

// ----- Tickets -----
// Categoría donde se crean los canales de ticket.
const CATEGORIA_TICKETS_ID = "1441676871086641172";
// IDs de los roles del staff que pueden ver y atender los tickets. Ejemplo: ["123...", "456..."]
// Si lo dejas vacío, solo los administradores (y quien tenga "Gestionar canales") ven los tickets.
const ROLES_STAFF_IDS = [
  "1441778132180009081",
  "1471124977356111954",
  "1441594428727754894",
  "1466587830729052435",
  "1441645297540268105",
  "1442163236505124864",
];
// Si es true, el bot menciona a los roles de staff cuando se abre un ticket.
const MENCIONAR_STAFF_AL_ABRIR = true;
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
// Los tickets se identifican por el "topic" del canal (ticket:ID_USUARIO:TIPO),
// así no se pierde nada si Railway reinicia el bot (no usa archivos).
const TIPOS_TICKET = {
  reportar_usuario: {
    label: "Reportar usuario",
    emoji: "🚨",
    prefijo: "reporte",
    color: 0xed4245,
    description: "Reporta a un usuario que rompe las reglas",
    descripcionPanel:
      "Reporta a un usuario que rompe las reglas. Ten a mano su nombre o ID y tus pruebas (capturas o videos).",
    mensaje:
      "Describe qué usuario quieres reportar y por qué. Si tienes pruebas (capturas, mensajes), adjúntalas aquí.",
    campos: [
      { id: "input_t_usuario", label: "Usuario a reportar (nombre o ID)", max: 100, requerido: true },
      { id: "input_t_que", label: "¿Qué pasó?", max: 1000, requerido: true, parrafo: true },
      {
        id: "input_t_pruebas",
        label: "Pruebas (links, opcional)",
        max: 500,
        requerido: false,
        parrafo: true,
        placeholder: "Links de capturas o videos",
      },
    ],
  },
  dudas: {
    label: "Dudas",
    emoji: "❓",
    prefijo: "duda",
    color: 0x5865f2,
    description: "Resuelve tus dudas con el staff",
    descripcionPanel:
      "Resuelve tus dudas con el staff. Cuéntanos con el mayor detalle qué necesitas saber.",
    mensaje: "Cuéntanos tu duda con el mayor detalle posible y el staff te responderá pronto.",
    campos: [
      { id: "input_t_asunto", label: "Asunto", max: 100, requerido: true, placeholder: "Ej: ¿Cómo funciona...?" },
      { id: "input_t_duda", label: "Describe tu duda", max: 1000, requerido: true, parrafo: true },
    ],
  },
  sorteo: {
    label: "Reclamar un sorteo",
    emoji: "🎁",
    prefijo: "sorteo",
    color: 0xfee75c,
    description: "Reclama un premio que ganaste en un sorteo",
    descripcionPanel:
      "Reclama el premio de un sorteo que ganaste. Indica en cuál ganaste y adjunta una captura del anuncio de ganador.",
    mensaje:
      "Indica en qué sorteo ganaste y adjunta una prueba (captura del anuncio de ganador) para validar tu premio.",
    campos: [
      { id: "input_t_sorteo", label: "Sorteo que ganaste", max: 100, requerido: true, placeholder: "Nombre o fecha del sorteo" },
      {
        id: "input_t_prueba",
        label: "Prueba (link, opcional)",
        max: 500,
        requerido: false,
        parrafo: true,
        placeholder: "También puedes adjuntar la captura dentro del ticket",
      },
    ],
  },
};

function esCanalDeTicket(canal) {
  return !!canal.topic && canal.topic.startsWith("ticket:");
}

// Devuelve el ID del usuario que abrió el ticket (a partir del topic del canal)
function propietarioTicket(canal) {
  if (!esCanalDeTicket(canal)) return null;
  return canal.topic.split(":")[1] ?? null;
}

function esStaff(member) {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageChannels) ||
    ROLES_STAFF_IDS.some((id) => member.roles.cache.has(id))
  );
}

function embedSimple(texto, color = 0x5865f2) {
  return new EmbedBuilder().setDescription(texto).setColor(color);
}

function ticketAbiertoDe(guild, userId) {
  return guild.channels.cache.find(
    (c) => esCanalDeTicket(c) && c.topic.startsWith(`ticket:${userId}:`)
  );
}

function filaMenuTickets() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("seleccionar_tipo_ticket")
      .setPlaceholder("📩 Elige el tipo de ticket")
      .addOptions(
        Object.entries(TIPOS_TICKET).map(([id, t]) => ({
          label: t.label,
          description: t.description,
          value: id,
          emoji: { name: t.emoji },
        }))
      )
  );
}

function botonesTicket(reclamado = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_cerrar")
      .setLabel("Cerrar ticket")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("ticket_reclamar")
      .setLabel(reclamado ? "Reclamado" : "Reclamar")
      .setEmoji("🙋")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(reclamado)
  );
}

function crearModalTicket(tipoId) {
  const t = TIPOS_TICKET[tipoId];
  return new ModalBuilder()
    .setCustomId(`modal_ticket:${tipoId}`)
    .setTitle(`${t.emoji} ${t.label}`.slice(0, 45))
    .addComponents(
      ...t.campos.map((f) => {
        const input = new TextInputBuilder()
          .setCustomId(f.id)
          .setLabel(f.label)
          .setStyle(f.parrafo ? TextInputStyle.Paragraph : TextInputStyle.Short)
          .setRequired(!!f.requerido)
          .setMaxLength(f.max);
        if (f.placeholder) input.setPlaceholder(f.placeholder);
        return new ActionRowBuilder().addComponents(input);
      })
    );
}

// Restablece el menú del panel para que no se quede seleccionada una opción
function resetearMenuPanel(interaction) {
  interaction.message.edit({ components: [filaMenuTickets()] }).catch(() => {});
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
    .setDescription("Publica el panel para abrir tickets")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("close")
    .setDescription("Cierra el ticket actual"),

  new SlashCommandBuilder()
    .setName("add")
    .setDescription("Agrega a alguien a este ticket")
    .addUserOption((op) =>
      op.setName("usuario").setDescription("Usuario a agregar").setRequired(true)
    ),
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

    // =====================================================
    //                    SISTEMA DE TICKETS
    // =====================================================

    // ---------- /panel-tickets ----------
    if (interaction.isChatInputCommand() && interaction.commandName === "panel-tickets") {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
          embeds: [embedSimple("❌ Solo los administradores pueden publicar este panel.", 0xed4245)],
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle("🎫 Sistema de Tickets")
        .setDescription(
          "¿Necesitas ayuda? Elige una opción del menú de abajo y abre un ticket.\n" +
            "Un miembro del staff te atenderá lo antes posible."
        )
        .addFields(
          ...Object.values(TIPOS_TICKET).map((t) => ({
            name: `${t.emoji} ${t.label}`,
            value: t.descripcionPanel,
            inline: false,
          })),
          {
            name: "📌 Antes de abrir un ticket",
            value:
              "• Solo puedes tener **un ticket abierto** a la vez.\n" +
              "• Sé respetuoso con el staff.\n" +
              "• No abras tickets falsos ni hagas spam.",
            inline: false,
          }
        )
        .setColor(0xed4245)
        .setThumbnail(interaction.guild.iconURL({ size: 256 }) ?? null)
        .setFooter({ text: `${interaction.guild.name} • Soporte` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], components: [filaMenuTickets()] });
      return;
    }

    // ---------- Menú desplegable: elegir el tipo de ticket ----------
    if (interaction.isStringSelectMenu() && interaction.customId === "seleccionar_tipo_ticket") {
      const tipoId = interaction.values[0];
      if (!TIPOS_TICKET[tipoId]) return;

      const yaAbierto = ticketAbiertoDe(interaction.guild, interaction.user.id);
      if (yaAbierto) {
        await interaction.reply({
          embeds: [
            embedSimple(
              `⚠️ Ya tienes un ticket abierto: <#${yaAbierto.id}>. Ciérralo antes de abrir otro.`,
              0xfee75c
            ),
          ],
          ephemeral: true,
        });
        resetearMenuPanel(interaction);
        return;
      }

      await interaction.showModal(crearModalTicket(tipoId));
      resetearMenuPanel(interaction);
      return;
    }

    // ---------- Formulario enviado: crear el canal del ticket ----------
    if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_ticket:")) {
      const tipoId = interaction.customId.split(":")[1];
      const tipo = TIPOS_TICKET[tipoId];
      if (!tipo) return;

      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;

      const yaAbierto = ticketAbiertoDe(guild, interaction.user.id);
      if (yaAbierto) {
        await interaction.editReply({
          embeds: [embedSimple(`⚠️ Ya tienes un ticket abierto: <#${yaAbierto.id}>`, 0xfee75c)],
        });
        return;
      }

      const respuestas = tipo.campos.map((f) => ({
        etiqueta: f.label,
        valor: interaction.fields.getTextInputValue(f.id).trim(),
      }));

      // Solo se usan los roles de staff que existen en el servidor
      const rolesStaff = ROLES_STAFF_IDS.filter((id) => guild.roles.cache.has(id));

      const permisosUsuario = [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ];

      const permisos = [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: permisosUsuario },
        {
          id: client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ManageChannels,
          ],
        },
        ...rolesStaff.map((id) => ({ id, allow: permisosUsuario })),
      ];

      // La categoría solo se usa si existe y realmente es una categoría
      const categoria = CATEGORIA_TICKETS_ID
        ? await guild.channels.fetch(CATEGORIA_TICKETS_ID).catch(() => null)
        : null;
      const parent = categoria?.type === ChannelType.GuildCategory ? categoria.id : undefined;

      const nombreBase = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "");
      const nombreCanal = `${tipo.prefijo}-${nombreBase || interaction.user.id}`.slice(0, 90);

      let canalTicket;
      try {
        canalTicket = await guild.channels.create({
          name: nombreCanal,
          type: ChannelType.GuildText,
          parent,
          topic: `ticket:${interaction.user.id}:${tipoId}`,
          permissionOverwrites: permisos,
        });
      } catch (e) {
        console.error(e);
        await interaction.editReply({
          embeds: [
            embedSimple(
              "❌ No pude crear el canal del ticket. Avisa a un administrador (el bot necesita los permisos **Gestionar canales** y **Gestionar roles**).",
              0xed4245
            ),
          ],
        });
        return;
      }

      const embedTicket = new EmbedBuilder()
        .setTitle(`${tipo.emoji} ${tipo.label}`)
        .setDescription(tipo.mensaje)
        .setColor(tipo.color)
        .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: "👤 Abierto por", value: `<@${interaction.user.id}>`, inline: true },
          { name: "📂 Tipo", value: tipo.label, inline: true },
          { name: "📌 Estado", value: "🟢 Abierto", inline: true },
          ...respuestas.map((r) => ({
            name: r.etiqueta,
            value: r.valor || "—",
            inline: false,
          }))
        )
        .setFooter({ text: "Usa /close para cerrar · /add @usuario para agregar a alguien" })
        .setTimestamp();

      const menciones = [
        `<@${interaction.user.id}>`,
        ...(MENCIONAR_STAFF_AL_ABRIR ? rolesStaff.map((id) => `<@&${id}>`) : []),
      ].join(" ");

      await canalTicket
        .send({ content: menciones, embeds: [embedTicket], components: [botonesTicket()] })
        .catch(console.error);

      await interaction.editReply({
        embeds: [embedSimple(`✅ Tu ticket fue creado: <#${canalTicket.id}>`, 0x57f287)],
      });
      return;
    }

    // ---------- Botón: Reclamar ticket (solo staff) ----------
    if (interaction.isButton() && interaction.customId === "ticket_reclamar") {
      if (!esCanalDeTicket(interaction.channel)) {
        await interaction.reply({
          embeds: [embedSimple("❌ Este canal no es un ticket.", 0xed4245)],
          ephemeral: true,
        });
        return;
      }
      if (!esStaff(interaction.member)) {
        await interaction.reply({
          embeds: [embedSimple("❌ Solo el staff puede reclamar tickets.", 0xed4245)],
          ephemeral: true,
        });
        return;
      }

      const yaReclamado = interaction.message.components?.[0]?.components?.some(
        (c) => c.customId === "ticket_reclamar" && c.disabled
      );
      if (yaReclamado) {
        await interaction.reply({
          embeds: [embedSimple("⚠️ Este ticket ya fue reclamado.", 0xfee75c)],
          ephemeral: true,
        });
        return;
      }

      const embedActualizado = EmbedBuilder.from(interaction.message.embeds[0]);
      const idx = (embedActualizado.data.fields ?? []).findIndex((f) => f.name === "📌 Estado");
      if (idx !== -1) {
        embedActualizado.spliceFields(idx, 1, {
          name: "📌 Estado",
          value: `🟡 Reclamado por <@${interaction.user.id}>`,
          inline: true,
        });
      }

      await interaction.update({ embeds: [embedActualizado], components: [botonesTicket(true)] });

      await interaction.channel
        .send({
          embeds: [
            new EmbedBuilder()
              .setTitle("🙋 Ticket reclamado")
              .setDescription(`<@${interaction.user.id}> se encargará de este ticket.`)
              .setColor(0xfee75c),
          ],
        })
        .catch(() => {});
      return;
    }

    // ---------- Botón: Cerrar ticket (pide confirmación) ----------
    if (interaction.isButton() && interaction.customId === "ticket_cerrar") {
      const canal = interaction.channel;
      if (!esCanalDeTicket(canal)) {
        await interaction.reply({
          embeds: [embedSimple("❌ Este canal no es un ticket.", 0xed4245)],
          ephemeral: true,
        });
        return;
      }
      if (interaction.user.id !== propietarioTicket(canal) && !esStaff(interaction.member)) {
        await interaction.reply({
          embeds: [embedSimple("❌ Solo quien abrió el ticket o el staff puede cerrarlo.", 0xed4245)],
          ephemeral: true,
        });
        return;
      }

      const confirmar = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_cerrar_si")
          .setLabel("Sí, cerrar")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("ticket_cerrar_no")
          .setLabel("Cancelar")
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({
        embeds: [embedSimple("¿Seguro que quieres cerrar este ticket? El canal se eliminará.", 0xfee75c)],
        components: [confirmar],
        ephemeral: true,
      });
      return;
    }

    if (interaction.isButton() && interaction.customId === "ticket_cerrar_no") {
      await interaction.update({
        embeds: [embedSimple("Cancelado. El ticket sigue abierto.")],
        components: [],
      });
      return;
    }

    if (interaction.isButton() && interaction.customId === "ticket_cerrar_si") {
      const canal = interaction.channel;
      if (!esCanalDeTicket(canal)) {
        await interaction.update({
          embeds: [embedSimple("❌ Este canal no es un ticket.", 0xed4245)],
          components: [],
        });
        return;
      }
      if (interaction.user.id !== propietarioTicket(canal) && !esStaff(interaction.member)) {
        await interaction.update({
          embeds: [embedSimple("❌ Solo quien abrió el ticket o el staff puede cerrarlo.", 0xed4245)],
          components: [],
        });
        return;
      }

      await interaction.update({
        embeds: [embedSimple("Cerrando ticket...")],
        components: [],
      });

      await canal
        .send({
          embeds: [
            new EmbedBuilder()
              .setTitle("🔒 Ticket cerrado")
              .setDescription(
                `Este ticket fue cerrado por <@${interaction.user.id}>.\nEl canal se eliminará en **5 segundos**.`
              )
              .setColor(0xed4245),
          ],
        })
        .catch(() => {});

      setTimeout(() => {
        canal.delete(`Ticket cerrado por ${interaction.user.tag}`).catch(() => {});
      }, 5000);
      return;
    }

    // ---------- /close ----------
    if (interaction.isChatInputCommand() && interaction.commandName === "close") {
      const canal = interaction.channel;

      if (!esCanalDeTicket(canal)) {
        await interaction.reply({
          embeds: [embedSimple("❌ Este comando solo funciona dentro de un ticket.", 0xed4245)],
          ephemeral: true,
        });
        return;
      }
      if (interaction.user.id !== propietarioTicket(canal) && !esStaff(interaction.member)) {
        await interaction.reply({
          embeds: [embedSimple("❌ Solo quien abrió el ticket o el staff puede cerrarlo.", 0xed4245)],
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🔒 Ticket cerrado")
            .setDescription(
              `Este ticket fue cerrado por <@${interaction.user.id}>.\nEl canal se eliminará en **5 segundos**.`
            )
            .setColor(0xed4245),
        ],
      });
      setTimeout(() => {
        canal.delete(`Ticket cerrado por ${interaction.user.tag}`).catch(() => {});
      }, 5000);
      return;
    }

    // ---------- /add ----------
    if (interaction.isChatInputCommand() && interaction.commandName === "add") {
      const canal = interaction.channel;

      if (!esCanalDeTicket(canal)) {
        await interaction.reply({
          embeds: [embedSimple("❌ Este comando solo funciona dentro de un ticket.", 0xed4245)],
          ephemeral: true,
        });
        return;
      }
      if (interaction.user.id !== propietarioTicket(canal) && !esStaff(interaction.member)) {
        await interaction.reply({
          embeds: [embedSimple("❌ Solo quien abrió el ticket o el staff puede agregar personas.", 0xed4245)],
          ephemeral: true,
        });
        return;
      }

      const usuario = interaction.options.getUser("usuario");

      await canal.permissionOverwrites.edit(usuario.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
      });

      await interaction.reply({
        embeds: [embedSimple(`➕ <@${usuario.id}> fue agregado al ticket.`, 0x57f287)],
      });
      return;
    }
  } catch (error) {
    console.error("Error en la interacción:", error);
    if (interaction.isRepliable()) {
      const payload = { content: "⚠️ Ocurrió un error al procesar la solicitud.", ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  }
});

client.login(TOKEN);