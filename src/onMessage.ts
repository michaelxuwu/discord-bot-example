import { Client, Message } from 'discord.js/typings/index.js'
import { loadArgsAndEnv } from './loadArgsAndEnv'
import Prefinery from './prefinery'
import { registerToTestnetComp } from './registerToTesnetComp'

loadArgsAndEnv(process.argv)

const isDebug = process.env.DEBUG
const DISCORD_DEBUG_USER = process.env.DISCORD_DEBUG_USER
const TRADING_COMP_CHANNEL_ID = isDebug
  ? process.env.DISCORD_TRADING_COMP_CHANNEL_ID_DEBUG
  : process.env.DISCORD_TRADING_COMP_CHANNEL_ID ?? ''

const LYRA_ALPHA_BOT_ID = process.env.DISCORD_ALPHA_BOT_ID

function commandHelp(message: Message) {
  message.channel.send('Use `!join` for instructions.')
}

function commandJoin(message: Message) {
  message.channel.send(
    `DM your address to <@${LYRA_ALPHA_BOT_ID}> to register for the trading competition. Make sure you “Allow Direct Messages” in this server's settings.`
  )
}

export async function onMessage(client: Client, prefineryClient: Prefinery, message: Message) {
  if (message.author.bot) return

  // const prefix = '!'
  const isMessageDM = message.channel.type === 'DM'

  if (isMessageDM) {
    if (isDebug && message.author.id !== DISCORD_DEBUG_USER) {
      return
    }
    await registerToTestnetComp(client, message)
    return
  }

  const args = message.content.trim().split(' ')
  const cmd = args[0].toLowerCase()

  if (message.channelId !== TRADING_COMP_CHANNEL_ID) {
    return
  }

  if (!cmd.startsWith('!')) {
    return
  }

  switch (cmd) {
    case '!help':
      commandHelp(message)
      break
    case '!join':
      commandJoin(message)
      break
    default:
      commandHelp(message)
      break
  }
}
