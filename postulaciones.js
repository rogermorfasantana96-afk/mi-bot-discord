// ================== SISTEMA DE POSTULACIONES — DEMON RACING ==================
// Este archivo va en la MISMA carpeta que bot-enviar.js
const fs = require("fs");
const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
  OverwriteType,
} = require("discord.js");

// ================== CONFIGURACIÓN ==================
// Categoría donde se crean los canales privados de postulación
const CATEGORIA_POSTULACIONES_ID = "1508414418944266350";
// Canal donde llegan los formularios para aceptar o rechazar
const CANAL_REVISION_ID = "1508256361320812574";
// Roles que pueden ver el canal de postulación y aceptar/rechazar formularios
const ROLES_POSTULACIONES = [
  "1441778132180009081",
  "1471124977356111954",
  "1441594428727754894",
  "1466587830729052435",
  "1441645297540268105",
  "1442163236505124864",
];

const MAX_RESPUESTA = 300; // caracteres por respuesta (límite de Discord para que el formulario quepa en un embed)
const INACTIVIDAD_MS = 30 * 60 * 1000; // si no responde en 30 minutos, se cierra el canal

const COLOR_PRINCIPAL = 0xed4245;
const COLOR_PENDIENTE = 0xfee75c;
const COLOR_ACEPTADO = 0x57f287;
const COLOR_RECHAZADO = 0xed4245;

const PREGUNTAS = [
  "Nombre IC",
  "ID del servidor",
  "¿Cuánto tiempo llevas jugando?",
  "¿Por qué quieres pertenecer al Demon Racing?",
  "¿Qué metas tienes para el taller?",
  "¿Qué tan activo eres en el servidor? (horarios)",
  "¿Tienes conocimiento básico sobre comandos mecánicos dentro del servidor?",
  "¿Estás dispuesto a seguir órdenes y reglas dentro del taller?",
  "¿Tienes micrófono disponible para (rol por voz)?",
  "¿Qué comandos conoces relacionados con reparación de vehículos?",
  "¿Qué harías si un cliente llega insultando sin razón?",
  "Edad OOC",
  "¿Eres ganguero?",
  "Del 1 al 10, ¿cuánto sabes de mecánica? (Sinceridad)",
];

// ================== DATOS GUARDADOS ==================
const ARCHIVO = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? `${process.env.RAILWAY_VOLUME_MOUNT_PATH}/postulaciones.json`
  : "./postulaciones.json";

// activas:    { canalId: { userId, indice, respuestas: [], ultima } }
// pendientes: { userId: idDelMensajeEnElCanalDeRevision }
let datos = { activas: {}, pendientes: {} };

function cargar() {
  try {
    if (!fs.existsSync(ARCHIVO)) return;
    const data = JSON.parse(fs.readFileSync(ARCHIVO, "utf8"));
    datos = { activas: data.activas ?? {}, pendientes: data.pendientes ?? {} };
  } catch (e) {
    console.error("Error al cargar postulaciones.json:", e);
  }
}

function guardar() {
  try {
    fs.writeFileSync(ARCHIVO, JSON.stringify(datos, null, 2));
  } catch (e) {
    console.error("Error al guardar postulaciones.json:", e);
  }
}

// ================== UTILIDADES ==================
function puedeRevisar(member) {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.roles.cache.some((r) => ROLES_POSTULACIONES.includes(r.id))
  );
}

function barraProgreso(actual, total) {
  return "▰".repeat(actual) + "▱".repeat(total - actual);
}

function fechaCorta(ms = Date.now()) {
  return new Date(ms)
    .toLocaleString("es-DO", {
      timeZone: "America/Santo_Domingo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
    .replace(",", "");
}

// Privado: @everyone no ve nada. Ven: la persona, los roles del staff (solo lectura) y el bot
function permisosCanal(guild, userId) {
  const roles = ROLES_POSTULACIONES.filter((id) => guild.roles.cache.has(id));
  return [
    { id: guild.roles.everyone.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] },
    ...roles.map((id) => ({
      id,
      type: OverwriteType.Role,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
    })),
    {
      id: guild.client.user.id,
      type: OverwriteType.Member,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ManageChannels,
      ],
    },
    {
      id: userId,
      type: OverwriteType.Member,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
  ];
}

// ================== EMBEDS ==================
function crearEmbedPanel(guild) {
  return new EmbedBuilder()
    .setColor(COLOR_PRINCIPAL)
    .setTitle("🛠️ DEMON RACING — POSTULACIONES")
    .setThumbnail(guild.iconURL({ size: 256 }) || null)
    .setDescription(
      "¿Te gustaría formar parte de nuestro equipo de mecánica?\nPresiona el botón de abajo para iniciar tu proceso."
    )
    .addFields(
      {
        name: "📋 ¿Cómo funciona?",
        value:
          "1️⃣ Presiona **Postularse**.\n" +
          "2️⃣ Se abrirá un **canal privado** solo para ti.\n" +
          "3️⃣ Responde las preguntas **una por una**.\n" +
          "4️⃣ Tu formulario llegará al staff para su revisión.\n" +
          "5️⃣ Te avisaremos el resultado por **mensaje privado**.",
      },
      {
        name: "⚠️ Antes de postularte",
        value:
          "• Responde con **honestidad**.\n" +
          `• Cada respuesta puede tener hasta **${MAX_RESPUESTA} caracteres**.\n` +
          "• Ten tus **mensajes privados abiertos** para recibir la respuesta.\n" +
          "• Solo puedes tener **una postulación** a la vez.",
      }
    )
    .setFooter({ text: "Demon Racing Recruitment", iconURL: guild.iconURL() || undefined });
}

function crearEmbedBienvenida(user) {
  return new EmbedBuilder()
    .setColor(COLOR_PRINCIPAL)
    .setTitle("🛠️ Postulación — Demon Racing")
    .setDescription(
      `Hola <@${user.id}>, bienvenido a tu proceso de postulación.\n\n` +
        `• Te haré **${PREGUNTAS.length} preguntas**, una por una.\n` +
        "• Escribe tu respuesta en este canal y aparecerá la siguiente pregunta.\n" +
        `• Cada respuesta puede tener hasta **${MAX_RESPUESTA} caracteres**.\n` +
        "• Responde con **honestidad**."
    );
}

function crearEmbedPregunta(i) {
  return new EmbedBuilder()
    .setColor(COLOR_PRINCIPAL)
    .setTitle(`📝 Pregunta ${i + 1} de ${PREGUNTAS.length}`)
    .setDescription(`${barraProgreso(i, PREGUNTAS.length)}\n\n**${PREGUNTAS[i]}**`)
    .setFooter({ text: "Escribe tu respuesta en este canal" });
}

function crearEmbedFormulario(user, respuestas) {
  return new EmbedBuilder()
    .setColor(COLOR_PENDIENTE)
    .setTitle("📋 Nueva postulación — Demon Racing")
    .setThumbnail(user.displayAvatarURL({ size: 128 }))
    .setDescription(
      `👤 **Postulante:** <@${user.id}> (${user.username})\n` +
        `🕒 **Enviada:** <t:${Math.floor(Date.now() / 1000)}:F>`
    )
    .addFields(
      PREGUNTAS.map((pregunta, i) => ({
        name: pregunta.slice(0, 256),
        value: (respuestas[i] || "—").slice(0, 1024),
      }))
    )
    .setFooter({ text: "⏳ Pendiente de revisión" });
}

function crearDmAceptado(guild, revisor) {
  return new EmbedBuilder()
    .setColor(COLOR_ACEPTADO)
    .setTitle("🎉 ¡Fuiste aceptado en Demon Racing!")
    .setThumbnail(guild.iconURL({ size: 256 }) || null)
    .setDescription(
      "Tu postulación fue **ACEPTADA**.\n¡Felicidades, ya formas parte de nuestro equipo de mecánica! 🛠️"
    )
    .addFields(
      {
        name: "📌 Próximos pasos",
        value:
          "• Mantente atento al servidor: el staff se comunicará contigo.\n" +
          "• Lee las reglas y normas del taller.\n" +
          "• Recuerda seguir siempre las órdenes del staff.",
      },
      { name: "👤 Revisado por", value: revisor.username, inline: true }
    )
    .setFooter({ text: "Demon Racing Recruitment" })
    .setTimestamp();
}

function crearDmRechazado(guild, revisor) {
  return new EmbedBuilder()
    .setColor(COLOR_RECHAZADO)
    .setTitle("📋 Resultado de tu postulación")
    .setThumbnail(guild.iconURL({ size: 256 }) || null)
    .setDescription(
      "Gracias por tu interés en **Demon Racing**.\nLamentablemente tu postulación **no fue aceptada** en esta ocasión."
    )
    .addFields(
      {
        name: "💬 ¿Qué puedes hacer?",
        value:
          "• Mejora tus conocimientos de mecánica y sigue activo en el servidor.\n" +
          "• Puedes volver a intentarlo más adelante.",
      },
      { name: "👤 Revisado por", value: revisor.username, inline: true }
    )
    .setFooter({ text: "Demon Racing Recruitment" })
    .setTimestamp();
}

// ================== COMANDOS (se registran desde bot-enviar.js) ==================
const comandos = [
  new SlashCommandBuilder()
    .setName("panel-postulaciones")
    .setDescription("Publica el panel de postulaciones para el taller")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
];

// ================== LÓGICA ==================
async function iniciarPostulacion(interaction) {
  const guild = interaction.guild;
  const user = interaction.user;

  await interaction.deferReply({ ephemeral: true });

  // 1) ¿Ya tiene un canal de postulación abierto?
  const activa = Object.entries(datos.activas).find(([, e]) => e.userId === user.id);
  if (activa) {
    const existe = await guild.channels.fetch(activa[0]).catch(() => null);
    if (existe) {
      await interaction.editReply({ content: `⚠️ Ya tienes una postulación en curso: <#${activa[0]}>` });
      return;
    }
    delete datos.activas[activa[0]];
    guardar();
  }

  // 2) ¿Ya tiene un formulario esperando revisión?
  const pendienteId = datos.pendientes[user.id];
  if (pendienteId) {
    const canalRev = await guild.channels.fetch(CANAL_REVISION_ID).catch(() => null);
    const mensaje = canalRev ? await canalRev.messages.fetch(pendienteId).catch(() => null) : null;
    const boton = mensaje?.components?.[0]?.components?.[0];
    if (boton && !boton.disabled) {
      await interaction.editReply({
        content: "⏳ Ya tienes una postulación **en revisión**. Espera la respuesta del staff.",
      });
      return;
    }
    delete datos.pendientes[user.id];
    guardar();
  }

  // 3) Categoría
  const categoria = await guild.channels.fetch(CATEGORIA_POSTULACIONES_ID).catch(() => null);
  if (!categoria || categoria.type !== ChannelType.GuildCategory) {
    await interaction.editReply({
      content: `❌ No encuentro la categoría de postulaciones (ID: \`${CATEGORIA_POSTULACIONES_ID}\`). Avisa al staff.`,
    });
    return;
  }

  // 4) Crear el canal privado
  const nombreLimpio = user.username.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80);
  const canal = await guild.channels.create({
    name: `postulacion-${nombreLimpio || user.id}`,
    type: ChannelType.GuildText,
    parent: categoria.id,
    topic: `postulacion:${user.id}`,
    permissionOverwrites: permisosCanal(guild, user.id),
  });

  datos.activas[canal.id] = { userId: user.id, indice: 0, respuestas: [], ultima: Date.now() };
  guardar();

  await canal.send({
    content: `<@${user.id}>`,
    embeds: [crearEmbedBienvenida(user), crearEmbedPregunta(0)],
    allowedMentions: { users: [user.id] },
  });

  await interaction.editReply({ content: `✅ Tu canal de postulación fue creado: <#${canal.id}>` });
}

async function finalizarPostulacion(canal, user, estado, guild) {
  const canalRev = await guild.channels.fetch(CANAL_REVISION_ID).catch(() => null);
  if (!canalRev || !canalRev.isTextBased()) {
    await canal
      .send("❌ No pude enviar tu formulario al staff. Avisa a un administrador y luego escribe cualquier mensaje aquí para reintentar.")
      .catch(() => {});
    return;
  }

  const botones = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`postu_aceptar:${user.id}`)
      .setLabel("Aceptar")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`postu_rechazar:${user.id}`)
      .setLabel("Rechazar")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger)
  );

  let enviado;
  try {
    enviado = await canalRev.send({
      embeds: [crearEmbedFormulario(user, estado.respuestas)],
      components: [botones],
    });
  } catch (e) {
    console.error("Error al enviar el formulario de postulación:", e);
    await canal
      .send("❌ No pude enviar tu formulario al staff. Avisa a un administrador y luego escribe cualquier mensaje aquí para reintentar.")
      .catch(() => {});
    return;
  }

  datos.pendientes[user.id] = enviado.id;
  delete datos.activas[canal.id];
  guardar();

  await canal
    .send({
      embeds: [
        new EmbedBuilder()
          .setColor(COLOR_ACEPTADO)
          .setTitle("✅ Formulario registrado")
          .setDescription(
            "Tu postulación fue enviada al staff.\n\n" +
              "⏳ **Espera su respuesta.** Te avisaremos por **mensaje privado**.\n\n" +
              "Este canal se cerrará en unos segundos."
          ),
      ],
    })
    .catch(() => {});

  setTimeout(() => {
    canal.delete("Postulación registrada").catch(() => {});
  }, 8000);
}

async function revisarPostulacion(interaction, aceptar, userId) {
  if (!puedeRevisar(interaction.member)) {
    await interaction.reply({ content: "❌ Solo el staff puede revisar postulaciones.", ephemeral: true });
    return;
  }

  const embed = EmbedBuilder.from(interaction.message.embeds[0])
    .setColor(aceptar ? COLOR_ACEPTADO : COLOR_RECHAZADO)
    .setFooter({ text: `Revisado por: ${interaction.user.username} • ${fechaCorta()}` });

  const fila = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("postu_resultado")
      .setLabel(aceptar ? "ACEPTADO" : "RECHAZADO")
      .setEmoji(aceptar ? "✅" : "❌")
      .setStyle(aceptar ? ButtonStyle.Success : ButtonStyle.Danger)
      .setDisabled(true)
  );

  await interaction.update({ embeds: [embed], components: [fila] });

  delete datos.pendientes[userId];
  guardar();

  // Mensaje privado al postulante
  const usuario = await interaction.client.users.fetch(userId).catch(() => null);
  let enviado = false;
  if (usuario) {
    const dm = aceptar
      ? crearDmAceptado(interaction.guild, interaction.user)
      : crearDmRechazado(interaction.guild, interaction.user);
    enviado = await usuario
      .send({ embeds: [dm] })
      .then(() => true)
      .catch(() => false);
  }

  if (!enviado) {
    await interaction
      .followUp({
        content: `⚠️ No pude enviarle el mensaje privado a <@${userId}> (tiene los mensajes privados cerrados). Avísale tú.`,
        ephemeral: true,
      })
      .catch(() => {});
  }
}

// ================== INICIO ==================
function iniciar(client) {
  cargar();

  const bloqueados = new Set(); // evita que dos mensajes seguidos se procesen a la vez
  const revisando = new Set(); // evita revisar dos veces el mismo formulario

  // ---------- Interacciones ----------
  client.on("interactionCreate", async (interaction) => {
    try {
      // /panel-postulaciones
      if (interaction.isChatInputCommand() && interaction.commandName === "panel-postulaciones") {
        const boton = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("postularse_btn")
            .setLabel("Postularse")
            .setEmoji("🛠️")
            .setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({ embeds: [crearEmbedPanel(interaction.guild)], components: [boton] });
        return;
      }

      // Botón: Postularse
      if (interaction.isButton() && interaction.customId === "postularse_btn") {
        await iniciarPostulacion(interaction);
        return;
      }

      // Botones: Aceptar / Rechazar
      if (
        interaction.isButton() &&
        (interaction.customId.startsWith("postu_aceptar:") || interaction.customId.startsWith("postu_rechazar:"))
      ) {
        const [accion, userId] = interaction.customId.split(":");

        if (revisando.has(interaction.message.id)) {
          await interaction.reply({ content: "⏳ Este formulario ya se está revisando.", ephemeral: true });
          return;
        }

        revisando.add(interaction.message.id);
        try {
          await revisarPostulacion(interaction, accion === "postu_aceptar", userId);
        } finally {
          revisando.delete(interaction.message.id);
        }
        return;
      }
    } catch (e) {
      console.error("Error en postulaciones:", e);
      const aviso = { content: `❌ Ocurrió un error: ${e.message}`, ephemeral: true };
      if (interaction.deferred) {
        await interaction.editReply({ content: aviso.content }).catch(() => {});
      } else if (interaction.isRepliable() && !interaction.replied) {
        await interaction.reply(aviso).catch(() => {});
      }
    }
  });

  // ---------- Respuestas en el canal de postulación ----------
  client.on("messageCreate", async (msg) => {
    if (msg.author.bot || !msg.guild) return;

    const estado = datos.activas[msg.channel.id];
    if (!estado || estado.userId !== msg.author.id) return;
    if (bloqueados.has(msg.channel.id)) return;

    bloqueados.add(msg.channel.id);
    try {
      if (estado.indice < PREGUNTAS.length) {
        const texto = msg.content.trim();

        if (!texto) {
          await msg.reply("✍️ Escribe tu respuesta con texto, por favor.").catch(() => {});
          return;
        }
        if (texto.length > MAX_RESPUESTA) {
          await msg
            .reply(
              `⚠️ Tu respuesta tiene ${texto.length} caracteres y el máximo es **${MAX_RESPUESTA}**. Escríbela de nuevo más corta.`
            )
            .catch(() => {});
          return;
        }

        estado.respuestas.push(texto);
        estado.indice++;
        estado.ultima = Date.now();
        guardar();

        if (estado.indice < PREGUNTAS.length) {
          await msg.channel.send({ embeds: [crearEmbedPregunta(estado.indice)] });
          return;
        }
      }

      // Ya respondió todo (o está reintentando el envío)
      await finalizarPostulacion(msg.channel, msg.author, estado, msg.guild);
    } catch (e) {
      console.error("Error al procesar una respuesta de postulación:", e);
    } finally {
      bloqueados.delete(msg.channel.id);
    }
  });

  // ---------- Si borran el canal a mano, se limpia el registro ----------
  client.on("channelDelete", (canal) => {
    if (datos.activas[canal.id]) {
      delete datos.activas[canal.id];
      guardar();
    }
  });

  // ---------- Cierra las postulaciones abandonadas ----------
  setInterval(async () => {
    const ahora = Date.now();
    for (const [canalId, estado] of Object.entries(datos.activas)) {
      if (ahora - estado.ultima < INACTIVIDAD_MS) continue;

      const canal = await client.channels.fetch(canalId).catch((err) => (err.code === 10003 ? "borrado" : null));
      if (canal === null) continue; // error temporal, se intenta después

      delete datos.activas[canalId];
      guardar();

      if (canal !== "borrado") {
        const usuario = await client.users.fetch(estado.userId).catch(() => null);
        if (usuario) {
          usuario
            .send({
              embeds: [
                new EmbedBuilder()
                  .setColor(COLOR_PENDIENTE)
                  .setTitle("⏰ Postulación cerrada")
                  .setDescription(
                    "Tu canal de postulación se cerró por **inactividad**.\nPuedes iniciar una nueva desde el panel de postulaciones."
                  ),
              ],
            })
            .catch(() => {});
        }
        await canal.delete("Postulación cerrada por inactividad").catch(() => {});
      }
    }
  }, 60 * 1000);
}

module.exports = { iniciar, comandos };