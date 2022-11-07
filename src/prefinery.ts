import axios from 'axios'
import { loadArgsAndEnv } from './loadArgsAndEnv'
loadArgsAndEnv(process.argv)
const PREFINERY_URL = 'https://api.prefinery.com/api/v2/'
const PROJECT_ID = process.env.PREFINERY_PROJECT_ID
const TERMS_QUESTION_ID = 108633

// Applied === double confirmed
export type PrefineryStatus =
  | 'applied'
  | 'invited'
  | 'active'
  | 'imported'
  | 'unconfirmed'
  | 'suspended'
  | 'unsuspended'

// https://www.prefinery.com/api/v2/docs/testers#list
export type PrefineryUser = {
  id: number
  email: string
  share_link: string
  status: PrefineryStatus
  profile: {
    custom_var1: string | null
    custom_var2: string | null
    custom_var3: string | null
  }
  errors?: string[]
}

type PrefineryUpdateBody = {
  status?: PrefineryStatus
  profile?: {
    custom_var1?: string
    custom_var2?: string
    custom_var3?: string
  }
}

type PrefineryUserUpdate = {
  status?: PrefineryStatus
  suspendedReason?: string
  discordUserId?: string
}

export default class Prefinery {
  apiKey: string
  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async listProjects() {
    const endpoint = `betas.json?api_key=${this.apiKey}`
    const url = PREFINERY_URL + endpoint
    return await axios.get(url, { params: { api_key: this.apiKey } })
  }

  async listUsers(email?: string): Promise<PrefineryUser[]> {
    const endpoint = `betas/${PROJECT_ID}/testers.json`
    const url = PREFINERY_URL + endpoint
    const result = await axios.get<PrefineryUser[]>(url, { params: { api_key: this.apiKey, email } })
    return result.data
  }

  async createUser(email: string, discordUserId: string): Promise<PrefineryUser> {
    const endpoint = `betas/${PROJECT_ID}/testers`
    const url = PREFINERY_URL + endpoint
    const result = await axios.post<PrefineryUser>(
      url,
      {
        tester: {
          email,
          status: 'unconfirmed',
          profile: { custom_var1: 'discord', custom_var2: discordUserId },
        },
      },
      {
        params: {
          api_key: this.apiKey,
        },
      }
    )
    return result.data
  }

  async updateUser(prefineryId: number | string, testerUpdate: PrefineryUserUpdate): Promise<PrefineryUser> {
    const endpoint = `betas/${PROJECT_ID}/testers/${prefineryId}`
    const url = PREFINERY_URL + endpoint
    let update: PrefineryUpdateBody = {}
    if (testerUpdate.discordUserId) {
      update = {
        ...update,
        profile: { ...update.profile, custom_var2: testerUpdate.discordUserId },
      }
    }
    if (testerUpdate.status) {
      update = {
        ...update,
        status: testerUpdate.status,
      }
    }
    if (testerUpdate.suspendedReason) {
      update = { ...update, profile: { ...update.profile, custom_var3: testerUpdate.suspendedReason } }
    }
    const result = await axios.put(
      url,
      {
        tester: {
          ...update,
          responses: { response: [{ question_id: TERMS_QUESTION_ID, answer: 1 }] },
        },
      },
      { params: { api_key: this.apiKey } }
    )
    return result.data
  }
}
