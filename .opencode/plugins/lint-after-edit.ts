import type { Plugin } from "@opencode-ai/plugin"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const exec = promisify(execFile)

const FORMATTABLE = /\.(ts|tsx|js|jsx|json|css|scss|html|md|yaml|yml|vue|svelte)$/
const LINTABLE = /\.(ts|tsx|js|jsx)$/

async function run(cmd: string, args: string[], cwd: string) {
  try {
    await exec(cmd, args, { cwd, timeout: 15000, stdio: "pipe" })
  } catch {}
}

export default (async () => {
  return {
    "tool.execute.after": async (input, output) => {
      if (input.tool !== "edit" && input.tool !== "write") return

      const filePath =
        input.args?.filePath || input.args?.file_path || ""
      if (!filePath) return

      const cwd = process.cwd()

      // prettier
      if (FORMATTABLE.test(filePath)) {
        await run("npx", ["--yes", "prettier", "--write", filePath], cwd)
      }

      // eslint --fix
      if (LINTABLE.test(filePath)) {
        await run("npx", ["--yes", "eslint", "--fix", filePath], cwd)
      }
    },
  }
}) satisfies Plugin
