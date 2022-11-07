import { Client, Message } from 'discord.js'
import { ethers } from 'ethers'
import { argv } from 'process'
import { Collections } from './constants/collections'
import connectToDatabase from './src/mongoConnector'
import { loadArgsAndEnv } from './loadArgsAndEnv'

loadArgsAndEnv(argv)
const isDebug = process.env.DEBUG
const ALPHA_ROLE_ID = process.env.DISCORD_ALPHA_ROLE_ID
const TRADER_ROLE_ID = process.env.DISCORD_TRADER_ROLE_ID
const BLOCMATES_ROLE_ID = process.env.DISCORD_BLOCMATES_ROLE_ID ?? ''
const CRYPTOTESTERS_ROLE_ID = process.env.DISCORD_CRYPTOTESTERS_ROLE_ID ?? ''
const LYRA_GUILD_ID = process.env.DISCORD_GUILD_ID ?? ''
const TRADING_COMP_CHANNEL_ID = isDebug
  ? process.env.DISCORD_TRADING_COMP_CHANNEL_ID_DEBUG
  : process.env.DISCORD_TRADING_COMP_CHANNEL_ID ?? ''
const TRADING_COMP_ROLE_ID = process.env.DISCORD_TRADING_COMP_ROLE_ID ?? ''

type TestnetCompRegistration = {
  discordUserId: string
  address: string
}

const REGISTRATION_CUTOFF_TIMESTAMP_MS = 1649894400000

export async function registerToTestnetComp(client: Client, message: Message) {
  const messageContent = message.content.trim()
  const now = new Date().getTime()

  if (now > REGISTRATION_CUTOFF_TIMESTAMP_MS) {
    message.channel.send('Registration for the trading competition has closed.')
    return
  }

  const [guilds, { db }] = await Promise.all([client.guilds.fetch(), connectToDatabase()])
  const guild = await guilds.get(LYRA_GUILD_ID)?.fetch()

  if (!guild) {
    message.channel.send(
      `${isDebug ? 'DEBUG: NO GUILD ' : ''}Error while registering. Please contact the team for support.`
    )
    return
  }

  let authorAsGuildMember
  const [_authorAsGuildMember, allRoles, allChannels] = await Promise.all([
    guild.members.fetch(message.author.id),
    guild.roles.fetch(),
    guild.channels.fetch(),
  ])
  authorAsGuildMember = _authorAsGuildMember
  const alphaRole = allRoles.find(role => role.id === ALPHA_ROLE_ID)
  const blocMatesRole = allRoles.find(role => role.id === BLOCMATES_ROLE_ID)
  const cryptotestersRole = allRoles.find(role => role.id === CRYPTOTESTERS_ROLE_ID)
  const traderRole = allRoles.find(role => role.id === TRADER_ROLE_ID)
  const tradingCompRole = allRoles.find(role => role.id === TRADING_COMP_ROLE_ID)
  const tradingCompChannel = allChannels.find(channel => channel.id === TRADING_COMP_CHANNEL_ID)
  if (
    !alphaRole ||
    !traderRole ||
    !authorAsGuildMember ||
    !tradingCompChannel ||
    !cryptotestersRole ||
    !blocMatesRole ||
    !tradingCompRole
  ) {
    message.channel.send(
      `${
        isDebug ? 'DEBUG: NO ALPHA ROLE, NOT A GUILD MEMBER OR NO TRADING COMP CHANNEL ' : ''
      }Error while registering. Please contact the team for support.`
    )
    return
  }

  if (
    !authorAsGuildMember.roles.cache.some(role =>
      [alphaRole.id, traderRole.id, cryptotestersRole.id, blocMatesRole.id].includes(role.id)
    )
  ) {
    message.channel.send(`${isDebug ? 'DEBUG: ' : ''}You are not eligible for the trading competition.`)
    return
  }
  const avalonTestnetCompCollection = db.collection(Collections.AvalonTestnetCompRegistrations)
  const registration = await avalonTestnetCompCollection.findOne<TestnetCompRegistration>({
    discordUserId: authorAsGuildMember.id,
  })

  let address: string
  try {
    address = ethers.utils.getAddress(messageContent)
  } catch (e) {
    if (registration) {
      message.channel.send(
        `You have successfully registered for the trading competition with the address: \`${registration.address}\``
      )
      return
    }
    message.channel.send(
      'Reply here with the wallet address (e.g. 0x123..456) that you would like to use for the trading competition.'
    )
    return
  }

  await avalonTestnetCompCollection.updateOne(
    { discordUserId: message.author.id },
    {
      $set: {
        address,
      },
    },
    { upsert: true }
  )
  authorAsGuildMember.roles.add(tradingCompRole)
  if (!registration || registration.address === address) {
    message.channel.send(
      `You have successfully registered for the trading competition with the address: \`${address}\`. You can update your registered address by replying here with a different address.`
    )
    if (!registration && tradingCompChannel.type === 'GUILD_TEXT') {
      tradingCompChannel.send(`<@${authorAsGuildMember.id}> registered an address for the trading competition!`)
    }
    return
  } else {
    message.channel.send(`Your registered address for the trading competition has been updated to: \`${address}\``)
  }
  return
}
