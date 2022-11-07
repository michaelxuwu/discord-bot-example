const dotenv = require('dotenv')

export function loadArgsAndEnv(argv: string[]) {
  if (process.env.IS_HEROKU) {
    return;
  }
  
  let result: { [key: string]: string } = {};
  for (let i = 0; i < argv.length - 1; i++) {
    if (argv[i].substr(0, 2) === "--") {
      result[argv[i].substr(2)] = argv[i + 1];
    }
  }

  if (result["env"] === undefined) {
    throw Error("Missing --env flag");
  }

  const parsed = dotenv.config({
    path: ".env." + result["env"],
  });

  if (parsed === undefined || parsed.parsed === undefined) {
    console.log(parsed);
    console.error(`Missing .env.${result["env"]} file`);
  }

  return result;
}