
import { loadArgsAndEnv } from './loadArgsAndEnv'
import { initializeAvalonAlphaBot } from './alphaBot'

loadArgsAndEnv(process.argv)
initializeAvalonAlphaBot().then(() => console.log('Avalon Alpha bot launched'))
