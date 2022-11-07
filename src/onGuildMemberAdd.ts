import { Client, GuildMember, Role } from 'discord.js'
import { argv } from 'process'
import { loadArgsAndEnv } from './loadArgsAndEnv'
import csv from 'csvtojson'

loadArgsAndEnv(argv)
const LYRA_GUILD_ID = process.env.DISCORD_GUILD_ID ?? ''
const PROGRAM_FILE = 'blocmates-cryptotesters.csv'
const BLOCMATES_ROLE_ID = process.env.DISCORD_BLOCMATES_ROLE_ID ?? ''
const CRYPTOTESTERS_ROLE_ID = process.env.DISCORD_CRYPTOTESTERS_ROLE_ID ?? ''

type ProgramUser = {
  Name: string
  'Discord ID': string
  Community: 'blocmates' | 'CryptoTesters'
}

// Assign cryptotesters and blocmates roles
async function onGuildMemberAdd(client: Client, member: GuildMember) {
  const guild = await client.guilds.fetch(LYRA_GUILD_ID)
  const [programUsers, cryptotestersRole, blocMatesRole]: [ProgramUser[], Role | null, Role | null] = await Promise.all(
    [
      csv().fromFile(`./scripts/alpha/${PROGRAM_FILE}`),
      guild.roles.fetch(CRYPTOTESTERS_ROLE_ID),
      guild.roles.fetch(BLOCMATES_ROLE_ID),
    ]
  )
  if (!cryptotestersRole || !blocMatesRole) {
    throw Error(`Error finding roles: CryptoTesters ${CRYPTOTESTERS_ROLE_ID}, Blocmates ${BLOCMATES_ROLE_ID}`)
  }
  const memberAsProgramUser = programUsers.find(user => user['Discord ID'] === member.id)
  if (!memberAsProgramUser) {
    return
  }
  if (memberAsProgramUser.Community === 'CryptoTesters') {
    await member.roles.add(cryptotestersRole)
    console.log(`Cryptotesters user added ${member.displayName}`)
  } else if (memberAsProgramUser.Community === 'blocmates') {
    await member.roles.add(blocMatesRole)
    console.log(`Blocmates user added ${member.displayName}`)
  }
  return
}

export default onGuildMemberAdd
