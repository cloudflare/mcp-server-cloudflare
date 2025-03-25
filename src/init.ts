// Shell out to `npx wrangler@latest whoami`
import { exec } from 'child_process'
import { promisify } from 'util'
import { AccountInfo, ensureWranglerAuthentication, fetchInternal, FetchResult, isDirectory } from './utils/wrangler'
import chalk from 'chalk'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'url'
import { createDialog, endSection, logRaw, startSection, updateStatus } from './utils/c3'
import { mcpCloudflareVersion } from './utils/helpers'
import which from 'which'
import readline from 'node:readline/promises'

const __filename = fileURLToPath(import.meta.url)

const execAsync = promisify(exec)

export async function init(accountTag: string | undefined) {
  logRaw(
    createDialog([
      `👋 Welcome to ${chalk.yellow('mcp-server-cloudflare')} v${mcpCloudflareVersion}!`,
      `💁‍♀️ This ${chalk.green("'init'")} process will ensure you're connected to the Cloudflare API`,
      `   and install the Cloudflare MCP Server into Claude Desktop (${chalk.blue.underline('https://claude.ai/download')})`,
      `ℹ️ For more information, visit ${chalk.blue.underline('https://github.com/cloudflare/mcp-server-cloudflare')}`,
      `🧡 Let's get started.`,
    ]),
  )

  startSection(`Checking for existing Wrangler auth info`, `Step 1 of 3`)
  updateStatus(chalk.gray(`If anything goes wrong, try running 'npx wrangler@latest login' manually and retrying.`))

  const authenticated = await ensureWranglerAuthentication()
  if (!authenticated) {
    throw new Error(
      'Failed to authenticate with Wrangler. Please try running npx wrangler@latest login manually and then retry.',
    )
  }

  updateStatus(`Wrangler auth info loaded!`)
  endSection('Done')
  startSection(`Fetching account info`, `Step 2 of 3`)

  const { result: accounts } = await fetchInternal<FetchResult<AccountInfo[]>>('/accounts')

  let account: string
  switch (accounts.length) {
    case 0:
      throw new Error(`No accounts found. Run 'wrangler whoami' for more info.`)
    case 1:
      if (accountTag && accountTag !== accounts[0].id) {
        throw new Error(`You don't have access to account ${accountTag}. Leave blank to use ${accounts[0].id}.`)
      }
      account = accounts[0].id
      break
    default:
      if (!accountTag) {
                updateStatus(chalk.blue('Multiple accounts detected. Please select an account to use:'))
        
        accounts.forEach((a, i) => {
          updateStatus(`${i + 1}. ${a.name} (${a.id})`)
        })
        
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        })
        
        let selection
        do {
          const answer = await rl.question('Enter the number of the account you want to use: ')
          selection = parseInt(answer) - 1
        } while (isNaN(selection) || selection < 0 || selection >= accounts.length)
        
        rl.close()
        account = accounts[selection].id
      } else {
        const validAccount = accounts.find(a => a.id === accountTag)
        if (!validAccount) {
          throw new Error(`You don't have access to account ${accountTag}. Please choose from your available accounts.`)
      }
      account = accountTag
    }
      break
  }

  updateStatus(`Using account: ${chalk.yellow(account)}`)
  endSection('Done')

  startSection(`Configuring Claude Desktop`, `Step 3 of 3`)

  const claudeConfigPath = path.join(
    os.homedir(),
    'Library',
    'Application Support',
    'Claude',
    'claude_desktop_config.json',
  )
  const cloudflareConfig = {
    command: (await which('node')).trim(),
    args: [__filename, 'run', account],
  }

  updateStatus(`Looking for existing config in: ${chalk.yellow(path.dirname(claudeConfigPath))}`)
  const configDirExists = isDirectory(path.dirname(claudeConfigPath))
  if (configDirExists) {
    const existingConfig = fs.existsSync(claudeConfigPath)
      ? JSON.parse(fs.readFileSync(claudeConfigPath, 'utf8'))
      : { mcpServers: {} }
    if ('cloudflare' in (existingConfig?.mcpServers || {})) {
      updateStatus(
        `${chalk.green('Note:')} Replacing existing Cloudflare MCP config:\n${chalk.gray(JSON.stringify(existingConfig.mcpServers.cloudflare))}`,
      )
    }
    const newConfig = {
      ...existingConfig,
      mcpServers: {
        ...existingConfig.mcpServers,
        cloudflare: cloudflareConfig,
      },
    }
    fs.writeFileSync(claudeConfigPath, JSON.stringify(newConfig, null, 2))

    updateStatus(`${chalk.yellow('mcp-server-cloudflare')} configured & added to Claude Desktop!`, false)
    updateStatus(`Wrote config to ${chalk.yellow(claudeConfigPath)}:`, false)
    updateStatus(chalk.gray(JSON.stringify(newConfig, null, 2)))
    updateStatus(chalk.blue(`Try asking Claude to "tell me which Workers I have on my account" to get started!`))
  } else {
    const fullConfig = { mcpServers: { cloudflare: cloudflareConfig } }
    updateStatus(
      `Couldn't detect Claude Desktop config at ${claudeConfigPath}.\nTo add the Cloudflare MCP server manually, add the following config to your ${chalk.yellow('claude_desktop_configs.json')} file:\n\n${JSON.stringify(fullConfig, null, 2)}`,
    )
  }

  endSection('Done')
}
