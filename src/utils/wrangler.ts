/*
 *
 * Methods copied from wrangler, same names used where possible
 *
 * */
import fs, { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import xdgAppPaths from 'xdg-app-paths'
import TOML from '@iarna/toml'
import assert from 'node:assert'
import { mcpCloudflareVersion } from './helpers'
import { fetch, Headers, Response, RequestInit, HeadersInit } from 'undici'
import { exec } from 'child_process'
import { promisify } from 'util'

export function isDirectory(configPath: string) {
  try {
    return fs.statSync(configPath).isDirectory()
  } catch (error) {
    // ignore error
    return false
  }
}

export function getGlobalWranglerConfigPath() {
  const configDir = xdgAppPaths('.wrangler').config() // New XDG compliant config path
  const legacyConfigDir = path.join(os.homedir(), '.wrangler') // Legacy config in user's home directory

  // Check for the .wrangler directory in root if it is not there then use the XDG compliant path.
  if (isDirectory(legacyConfigDir)) {
    return legacyConfigDir
  } else {
    return configDir
  }
}

const TOML_ERROR_NAME = 'TomlError'
const TOML_ERROR_SUFFIX = ' at row '

type TomlError = Error & {
  line: number
  col: number
}

export function parseTOML(input: string, file?: string): TOML.JsonMap | never {
  try {
    // Normalize CRLF to LF to avoid hitting https://github.com/iarna/iarna-toml/issues/33.
    const normalizedInput = input.replace(/\r\n/g, '\n')
    return TOML.parse(normalizedInput)
  } catch (err) {
    const { name, message, line, col } = err as TomlError
    if (name !== TOML_ERROR_NAME) {
      throw err
    }
    const text = message.substring(0, message.lastIndexOf(TOML_ERROR_SUFFIX))
    const lineText = input.split('\n')[line]
    const location = {
      lineText,
      line: line + 1,
      column: col - 1,
      file,
      fileText: input,
    }
    throw new Error(`Error parsing TOML: ${text} at ${JSON.stringify(location)}`)
  }
}

const JSON_ERROR_SUFFIX = ' in JSON at position '

/**
 * A wrapper around `JSON.parse` that throws a `ParseError`.
 */
export function parseJSON<T>(input: string, file?: string): T {
  try {
    return JSON.parse(input)
  } catch (err) {
    const { message } = err as Error
    const index = message.lastIndexOf(JSON_ERROR_SUFFIX)
    if (index < 0) {
      throw err
    }
    const text = message.substring(0, index)
    const position = parseInt(message.substring(index + JSON_ERROR_SUFFIX.length))
    const location = { file, fileText: input, position }
    throw new Error(`Error parsing JSON: ${text} at ${JSON.stringify(location)}`)
  }
}

/**
 * The tokens related to authentication.
 */
export interface AuthTokens {
  accessToken?: AccessToken
  refreshToken?: RefreshToken
  scopes?: Scope[]
}

interface RefreshToken {
  value: string
}

interface AccessToken {
  value: string
  expiry: string
}

type Scope = string

interface State extends AuthTokens {
  authorizationCode?: string
  codeChallenge?: string
  codeVerifier?: string
  hasAuthCodeBeenExchangedForAccessToken?: boolean
  stateQueryParam?: string
  scopes?: Scope[]
}

export let LocalState: State = {}

function getAuthConfigFilePath() {
  const configDir = getGlobalWranglerConfigPath()
  return path.join(configDir, 'config', 'default.toml')
}

export function getAuthTokens() {
  const configPath = getAuthConfigFilePath()

  if (!fs.existsSync(configPath)) throw new Error(`No config file found at ${configPath}`)

  const toml = parseTOML(readFileSync(configPath, 'utf8')) as {
    oauth_token?: string
    refresh_token?: string
    expiration_time?: string
    scopes?: string[]
  }

  // console.log('WE GOT IT')
  // console.log(toml)
  const { oauth_token, refresh_token, expiration_time, scopes } = toml

  LocalState = {
    accessToken: {
      value: oauth_token!,
      // If there is no `expiration_time` field then set it to an old date, to cause it to expire immediately.
      expiry: expiration_time ?? '2000-01-01:00:00:00+00:00',
    },
    refreshToken: { value: refresh_token ?? '' },
    scopes: scopes ?? [],
  }
}

export function isAccessTokenExpired(): boolean {
  const { accessToken } = LocalState
  return Boolean(accessToken && new Date() >= new Date(accessToken.expiry))
}

export async function refreshToken(): Promise<boolean> {
  // refresh
  try {
    await exchangeRefreshTokenForAccessToken()
    writeAuthConfigFile({
      oauth_token: LocalState.accessToken?.value,
      expiration_time: LocalState.accessToken?.expiry,
      refresh_token: LocalState.refreshToken?.value,
      scopes: LocalState.scopes,
    })
    return true
  } catch (err) {
    return false
  }
}

export interface UserAuthConfig {
  oauth_token?: string
  refresh_token?: string
  expiration_time?: string
  scopes?: string[]
  /** @deprecated - this field was only provided by the deprecated v1 `wrangler config` command. */
  api_token?: string
}

/**
 * Writes a a wrangler config file (auth credentials) to disk,
 * and updates the user auth state with the new credentials.
 */
export function writeAuthConfigFile(config: UserAuthConfig) {
  const configPath = getAuthConfigFilePath()

  mkdirSync(path.dirname(configPath), {
    recursive: true,
  })
  writeFileSync(path.join(configPath), TOML.stringify(config as TOML.JsonMap), {
    encoding: 'utf-8',
  })
}

const WRANGLER_CLIENT_ID = '54d11594-84e4-41aa-b438-e81b8fa78ee7'

async function fetchAuthToken(body: URLSearchParams) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  }
  return await fetch('https://dash.cloudflare.com/oauth2/token', {
    method: 'POST',
    body: body.toString(),
    headers,
  })
}

async function exchangeRefreshTokenForAccessToken() {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: LocalState.refreshToken?.value ?? '',
    client_id: WRANGLER_CLIENT_ID,
  })

  const response = await fetchAuthToken(params)

  if (response.status >= 400) {
    let tokenExchangeResErr = undefined

    try {
      tokenExchangeResErr = await response.text()
      tokenExchangeResErr = JSON.parse(tokenExchangeResErr)
    } catch (e) {
      // If it can't parse to JSON ignore the error
    }

    if (tokenExchangeResErr !== undefined) {
      // We will throw the parsed error if it parsed correctly, otherwise we throw an unknown error.
      throw typeof tokenExchangeResErr === 'string' ? new Error(tokenExchangeResErr) : tokenExchangeResErr
    } else {
      throw new Error('Failed to parse Error from exchangeRefreshTokenForAccessToken')
    }
  } else {
    const json = (await getJSONFromResponse(response)) as TokenResponse
    if ('error' in json) {
      throw json.error
    }

    const { access_token, expires_in, refresh_token, scope } = json
    let scopes: Scope[] = []

    const accessToken: AccessToken = {
      value: access_token,
      expiry: new Date(Date.now() + expires_in * 1000).toISOString(),
    }
    LocalState.accessToken = accessToken

    if (refresh_token) {
      LocalState.refreshToken = {
        value: refresh_token,
      }
    }

    if (scope) {
      // Multiple scopes are passed and delimited by spaces,
      // despite using the singular name "scope".
      scopes = scope.split(' ') as Scope[]
      LocalState.scopes = scopes
    }
  }
}

type TokenResponse =
  | {
      access_token: string
      expires_in: number
      refresh_token: string
      scope: string
    }
  | {
      error: string
    }

async function getJSONFromResponse(response: Response) {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch (e) {
    // Sometime we get an error response where the body is HTML
    if (text.match(/<!DOCTYPE html>/)) {
      console.error(
        'The body of the response was HTML rather than JSON. Check the debug logs to see the full body of the response.',
      )
      if (text.match(/challenge-platform/)) {
        console.error(
          `It looks like you might have hit a bot challenge page. This may be transient but if not, please contact Cloudflare to find out what can be done. When you contact Cloudflare, please provide your Ray ID: ${response.headers.get('cf-ray')}`,
        )
      }
    }
    console.debug('Full body of response\n\n', text)
    throw new Error(`Invalid JSON in response: status: ${response.status} ${response.statusText}`, { cause: e })
  }
}

export async function fetchInternal<ResponseType>(
  resource: string,
  init: RequestInit = {},
  queryParams?: URLSearchParams,
  abortSignal?: AbortSignal,
): Promise<ResponseType> {
  const method = init.method ?? 'GET'
  const response = await performApiFetch(resource, init, queryParams, abortSignal)
  const jsonText = await response.text()
  // logger.debug(
  // 	"-- START CF API RESPONSE:",
  // 	response.statusText,
  // 	response.status
  // );
  const logHeaders = cloneHeaders(response.headers)
  delete logHeaders['Authorization']
  // logger.debugWithSanitization("HEADERS:", JSON.stringify(logHeaders, null, 2));
  // logger.debugWithSanitization("RESPONSE:", jsonText);
  // logger.debug("-- END CF API RESPONSE");

  // HTTP 204 and HTTP 205 responses do not return a body. We need to special-case this
  // as otherwise parseJSON will throw an error back to the user.
  if (!jsonText && (response.status === 204 || response.status === 205)) {
    const emptyBody = `{"result": {}, "success": true, "errors": [], "messages": []}`
    return parseJSON<ResponseType>(emptyBody)
  }

  try {
    return parseJSON<ResponseType>(jsonText)
  } catch (err) {
    throw new Error(
      JSON.stringify({
        text: 'Received a malformed response from the API',
        notes: [
          {
            text: truncate(jsonText, 100),
          },
          {
            text: `${method} ${resource} -> ${response.status} ${response.statusText}`,
          },
        ],
        status: response.status,
      }),
    )
  }
}

/*
 * performApiFetch does everything required to make a CF API request,
 * but doesn't parse the response as JSON. For normal V4 API responses,
 * use `fetchInternal`
 * */
export async function performApiFetch(
  resource: string,
  init: RequestInit = {},
  queryParams?: URLSearchParams,
  abortSignal?: AbortSignal,
) {
  const method = init.method ?? 'GET'
  assert(resource.startsWith('/'), `CF API fetch - resource path must start with a "/" but got "${resource}"`)
  // await requireLoggedIn();
  const apiToken = requireApiToken()
  const headers = cloneHeaders(init.headers)
  addAuthorizationHeaderIfUnspecified(headers, apiToken)
  addUserAgent(headers)

  const queryString = queryParams ? `?${queryParams.toString()}` : ''
  // logger.debug(
  // 	`-- START CF API REQUEST: ${method} ${getCloudflareApiBaseUrl()}${resource}${queryString}`
  // );
  const logHeaders = cloneHeaders(headers)
  delete logHeaders['Authorization']
  // logger.debugWithSanitization("HEADERS:", JSON.stringify(logHeaders, null, 2));

  // logger.debugWithSanitization("INIT:", JSON.stringify({ ...init }, null, 2));
  // if (init.body instanceof FormData) {
  // 	logger.debugWithSanitization(
  // 		"BODY:",
  // 		await new Response(init.body).text(),
  // 		null,
  // 		2
  // 	);
  // }
  // logger.debug("-- END CF API REQUEST");
  return await fetch(`${getCloudflareApiBaseUrl()}${resource}${queryString}`, {
    method,
    ...init,
    headers,
    signal: abortSignal,
  })
}

export type ApiCredentials =
  | {
      apiToken: string
    }
  | {
      authKey: string
      authEmail: string
    }

export function requireApiToken(): ApiCredentials {
  const credentials = LocalState.accessToken?.value
  if (!credentials) {
    throw new Error('No API token found.')
  }
  return { apiToken: credentials }
}

function cloneHeaders(headers: HeadersInit | undefined): Record<string, string> {
  return headers instanceof Headers
    ? Object.fromEntries(headers.entries())
    : Array.isArray(headers)
      ? Object.fromEntries(headers)
      : ({ ...headers } as Record<string, string>)
}

function addAuthorizationHeaderIfUnspecified(headers: Record<string, string>, auth: ApiCredentials): void {
  if (!('Authorization' in headers)) {
    if ('apiToken' in auth) {
      headers['Authorization'] = `Bearer ${auth.apiToken}`
    } else {
      headers['X-Auth-Key'] = auth.authKey
      headers['X-Auth-Email'] = auth.authEmail
    }
  }
}

function addUserAgent(headers: Record<string, string>): void {
  headers['User-Agent'] = `mcp-cloudflare/${mcpCloudflareVersion}`
}
export const getCloudflareApiBaseUrl = () => 'https://api.cloudflare.com/client/v4'

function truncate(text: string, maxLength: number): string {
  const { length } = text
  if (length <= maxLength) {
    return text
  }
  return `${text.substring(0, maxLength)}... (length = ${length})`
}

export interface FetchError {
  code: number
  message: string
  error_chain?: FetchError[]
}

export interface FetchResult<ResponseType = unknown> {
  success: boolean
  result: ResponseType
  errors: FetchError[]
  messages?: string[]
  result_info?: unknown
}

export type AccountInfo = { name: string; id: string }

const execAsync = promisify(exec)

/**
 * Checks if the user is authenticated with Wrangler and runs the login command if needed.
 * @returns A promise that resolves to true if the user is authenticated, false otherwise
 */
export async function ensureWranglerAuthentication(): Promise<boolean> {
  try {
    // Try to get auth tokens
    getAuthTokens()
    
    // If tokens are expired, try to refresh them
    if (isAccessTokenExpired()) {
      console.log('Wrangler access token expired, attempting to refresh...')
      if (await refreshToken()) {
        console.log('Successfully refreshed Wrangler access token')
        return true
      } else {
        console.log('Failed to refresh Wrangler access token, running wrangler login...')
      }
    } else {
      // Tokens exist and are not expired
      return true
    }
  } catch (e) {
    // If we can't get auth tokens, we need to run wrangler login
    console.log('No Wrangler authentication found, running wrangler login...')
  }

  try {
    // Run wrangler login
    console.log('Running npx wrangler login. Please follow the prompts in your browser...')
    const { stderr, stdout } = await execAsync('npx wrangler@latest login')
    if (stderr) console.error(stderr)
    if (stdout) console.log(stdout)
    
    // Try to get auth tokens again
    getAuthTokens()
    return true
  } catch (error) {
    console.error('Failed to run wrangler login:', error)
    return false
  }
}
