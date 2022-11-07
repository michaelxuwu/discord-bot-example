import Prefinery, { PrefineryUser } from './prefinery'
import { Client, Message, Role, TextChannel } from 'discord.js/typings/index.js'
import { loadArgsAndEnv } from './loadArgsAndEnv'
import connectToDatabase from './mongoConnector'
import { Db } from 'mongodb'
import { Collections } from './constants/collections'

loadArgsAndEnv(process.argv)

const isDebug = process.env.DEBUG
const LYRA_NEW_GUILD_ID = process.env.DISCORD_LYRA_NEW_GUILD_ID ?? ''
const ALPHA_WAITLIST_CHANNEL = isDebug
  ? process.env.DISCORD_LYRA_NEW_GENERAL_CHANNEL_ID ?? ''
  : process.env.DISCORD_ALPHA_WAITLIST_CHANNEL_ID ?? ''
const WAITLIST_ROLE_ID = process.env.DISCORD_WAITLIST_ROLE_ID
const LYRA_GUILD_ID = isDebug ? LYRA_NEW_GUILD_ID : process.env.DISCORD_GUILD_ID ?? ''
const LYRA_WAITING_ROOM_CHANNEL = isDebug ? '' : process.env.DISCORD_ALPHA_WAITING_ROOM_CHANNEL_ID ?? ''

export type AlphaRegisteredUser = {
  email: string
  discordUserId: string
}

function validateEmail(email: string) {
  var re = /\S+@\S+\.\S+/
  return re.test(email)
}

export async function registerToWaitlist(discordClient: Client, prefinery: Prefinery, message: Message) {
  const messageContent = message.content.trim()
  // Check db for existing email/discord ID
  const [guilds, { db }] = await Promise.all([discordClient.guilds.fetch(), connectToDatabase()])
  const guild = await guilds.get(LYRA_GUILD_ID)?.fetch()

  let authorAsGuildMember
  let waitlistRole: Role | null
  let waitlistChannel: TextChannel | null

  try {
    if (!guild) {
      throw Error(`Error finding guild: ${LYRA_GUILD_ID}`)
    }
    // Get Discord role + channel info + try find Prefinery user by email
    const [_waitlistChannel, _authorAsGuildMember, allRoles] = await Promise.all([
      guild.channels.fetch(ALPHA_WAITLIST_CHANNEL),
      guild.members.fetch(message.author.id),
      guild.roles.fetch(),
    ])
    authorAsGuildMember = _authorAsGuildMember
    waitlistChannel =
      _waitlistChannel && _waitlistChannel.type === 'GUILD_TEXT' ? (_waitlistChannel as TextChannel) : null
    waitlistRole = allRoles.find(role => role.id === WAITLIST_ROLE_ID) ?? null
  } catch (e) {
    console.error(e)
    message.channel.send(`There was an error verifying your email. Please contact the team for support.`)
    return
  }
  const registeredDiscordUser = await getUserRegistrationByDiscordId(db, message.author.id)
  let prefineryUsers: PrefineryUser[]
  // If registered in DB, confirm status
  if (registeredDiscordUser) {
    try {
      prefineryUsers = await prefinery.listUsers(registeredDiscordUser.email)
    } catch (e) {
      console.error(`Error fetching Prefinery User: ${e}`)
      message.channel.send('There was an error verifying your email. Pleae try again or contact the team for support.')
      return
    }

    if (prefineryUsers && prefineryUsers.length) {
      const matchedUser = prefineryUsers[0]
      // Handle user with suspended status
      if (matchedUser.status === 'suspended') {
        message.channel.send(`Your email was suspended. Please contact the team if you believe this is a mistake.`)
        return
      }
      // Handle user with unconfirmed status
      if (matchedUser.status === 'unconfirmed') {
        message.channel.send(`To complete your registration, you need to verify your email.`)
        return
      }

      message.channel.send(
        `${isDebug ? 'DEBUG: ' : ''}You’re on the waitlist, your registered email is: ${
          registeredDiscordUser.email
        }. Check the <#${LYRA_WAITING_ROOM_CHANNEL}>`
      )
      return
    }
  }

  const isEmailFormat = validateEmail(messageContent)
  if (!isEmailFormat) {
    message.channel.send(
      `${isDebug ? 'DEBUG:' : ''}Welcome!
Reply here with an email you want to use for Lyra’s Alpha Program. 
If you have already signed up at https://alpha.lyra.finance, reply with the same email so we can verify your spot on the waitlist.
`
    )
    return
  }
  const emailInput = messageContent.toLowerCase()

  // Check prefinery
  try {
    prefineryUsers = await prefinery.listUsers(emailInput)
  } catch (e) {
    console.error(`Error fetching Prefinery User: ${e}`)
    message.channel.send('There was an error verifying your email. Pleae try again or contact the team for support.')
    return
  }

  // User has already registered in DB
  const registeredUser = await getUserRegistration(db, message.author.id, emailInput)
  if (registeredUser) {
    if (registeredUser.discordUserId === message.author.id) {
      message.channel.send(
        `${isDebug ? 'DEBUG: ' : ''}You’ve already signed up with this discord account, your registered email is: ${
          registeredUser.email
        }`
      )
      return
    }
    if (registeredUser.email === emailInput) {
      message.channel.send(`${isDebug ? 'DEBUG: ' : ''}This email has already been registered`)
      return
    }
    // Shouldn't get here
    return
  }

  // Prefinery user doesn't exist
  if (!prefineryUsers || prefineryUsers.length === 0) {
    // Register new user
    try {
      const matchedUser = await prefinery.createUser(emailInput, message.author.id)
      message.channel.send(
        ` You’ve been added to the <#${LYRA_WAITING_ROOM_CHANNEL}>! Check for your confirmation email. You can refer traders with this unique link to move up the waitlist:  ${matchedUser.share_link}`
      )
    } catch (e) {
      console.error('Error creating Prefinery user', e)
      message.channel.send(`There was an error registering your email. Please contact the team for support.`)
      return
    }
  } else {
    const matchedUser = prefineryUsers[0]
    // Handle user with suspended status
    if (matchedUser.status === 'suspended') {
      message.channel.send(`Your email was suspended. Please contact the team if you believe this is a mistake.`)
      return
    }
    // Handle user with unconfirmed status
    if (matchedUser.status === 'unconfirmed') {
      message.channel.send(`To complete your registration, you need to verify your email.`)
      return
    }
    // Update Prefinery entry with Discord ID
    try {
      const updatedUser = await prefinery.updateUser(matchedUser.id, { discordUserId: message.author.id })
      message.channel.send(
        `You're officially on the waitlist! Check the <#${LYRA_WAITING_ROOM_CHANNEL}> channel for updates. A reminder that you can refer traders with this unique link to move up the waitlist: ${matchedUser.share_link}`
      )
    } catch (e) {
      console.error('Error updating Prefinery user', e)
      message.channel.send(`There was an error registering your email. Please contact the team for support.`)
      return
    }
  }

  // Not in guild or error finding waitlist role (shouldn't happen)
  if (authorAsGuildMember && waitlistRole) {
    authorAsGuildMember.roles.add(waitlistRole).catch(e => {
      console.error(e)
      message.channel.send(
        `There was an error assigning your waitlist role. Please contact the team with your details for support.`
      )
    })
  }
  // Announce in waitlist channel
  if (waitlistChannel) {
    waitlistChannel.send(`<@${message.author.id}> is on the waitlist!`)
  }
  // Register user in the DB
  registerUser(db, message.author.id, emailInput)
  return
}

async function getUserRegistration(db: Db, discordUserId: string, email: string): Promise<AlphaRegisteredUser | null> {
  const alphaRegistrations = db.collection(Collections.AvalonAlphaRegistrations)
  const registeredUser = await alphaRegistrations.findOne<AlphaRegisteredUser>({
    $or: [{ email }, { discordUserId }],
  })
  return registeredUser
}

async function getUserRegistrationByDiscordId(db: Db, discordUserId: string) {
  const alphaRegistrations = db.collection(Collections.AvalonAlphaRegistrations)
  const registeredUser = await alphaRegistrations.findOne<AlphaRegisteredUser>({ discordUserId })
  return registeredUser
}

function registerUser(db: Db, discordUserId: string, email: string) {
  const alphaRegistrations = db.collection(Collections.AvalonAlphaRegistrations)
  alphaRegistrations.insertOne({ email, discordUserId })
}
