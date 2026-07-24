import { homedir } from "node:os";
import { isAbsolute, join, parse, resolve } from "node:path";

const loopbackHost = "127.0.0.1";

export interface ServerConfig {
  readonly host: typeof loopbackHost;
  readonly port: number;
  readonly dataDirectory: string;
  readonly allowedOrigins: readonly string[];
  readonly webAssetsDirectory: string;
  readonly codexWorkspace?: string;
}

function parsePort(value: string | undefined): number {
  if (value === undefined) {
    return 4317;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error("MODELS_ROUNDTABLE_PORT must be a valid TCP port.");
  }
  return parsed;
}

function configuredDataDirectory(value: string | undefined): string {
  if (value === undefined || value.trim() === "") {
    return join(homedir(), ".roundtable-data");
  }
  return resolve(value);
}

export function loadServerConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ServerConfig {
  const host = environment.MODELS_ROUNDTABLE_HOST ?? loopbackHost;
  if (host !== loopbackHost) {
    throw new Error(
      "Personal Mode only permits MODELS_ROUNDTABLE_HOST=127.0.0.1.",
    );
  }

  const port = parsePort(environment.MODELS_ROUNDTABLE_PORT);
  const configuredWorkspace = environment.MODELS_ROUNDTABLE_CODEX_WORKSPACE;
  let codexWorkspace: string | undefined;
  if (configuredWorkspace !== undefined && configuredWorkspace.trim() !== "") {
    if (!isAbsolute(configuredWorkspace)) {
      throw new Error("MODELS_ROUNDTABLE_CODEX_WORKSPACE must be absolute.");
    }
    codexWorkspace = resolve(configuredWorkspace);
    if (codexWorkspace === parse(codexWorkspace).root) {
      throw new Error(
        "MODELS_ROUNDTABLE_CODEX_WORKSPACE cannot be a filesystem root.",
      );
    }
  }
  return {
    host: loopbackHost,
    port,
    dataDirectory: configuredDataDirectory(
      environment.MODELS_ROUNDTABLE_DATA_DIR,
    ),
    allowedOrigins: [
      "http://" + loopbackHost + ":" + port,
      "http://localhost:5173",
      "http://" + loopbackHost + ":5173",
    ],
    webAssetsDirectory: resolve(process.cwd(), "../web/dist"),
    ...(codexWorkspace === undefined ? {} : { codexWorkspace }),
  };
}
