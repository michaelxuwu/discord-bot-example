import { onMessage } from './onMessage'
import { Client, Intents } from 'discord.js'
import Prefinery from './prefinery'
import onGuildMemberAdd from './onGuildMemberAdd'

require('dotenv').config()

export async function initializeAvalonAlphaBot() {
  const DISCORD_ALPHA_BOT_TOKEN = process.env.DISCORD_ALPHA_BOT_TOKEN
  const client = new Client({
    intents: [
      Intents.FLAGS.GUILDS,
      Intents.FLAGS.GUILD_MEMBERS,
      Intents.FLAGS.GUILD_MESSAGES,
      Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
      Intents.FLAGS.DIRECT_MESSAGES,
    ],
    partials: ['USER', 'GUILD_MEMBER', 'MESSAGE', 'CHANNEL', 'REACTION'],
  })
  const prefineryClient = new Prefinery(process.env.PREFINERY_API_KEY ?? '')
  client.on('ready', async client => {
    console.log('Avalon alpha bot is online!')
  })

  client.on('messageCreate', (...args) => {
    console.log(args)
    onMessage(client, prefineryClient, ...args)
  })

  client.on('guildMemberAdd', (...args) => {
    onGuildMemberAdd(client, ...args)
  })

  try {
    await client.login(DISCORD_ALPHA_BOT_TOKEN)
  } catch (e) {
    throw Error(`Error logging in to Discord client: ${e}`)
  }
}
