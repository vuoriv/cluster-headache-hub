/**
 * Tests that all internal Link targets match defined routes.
 * Prevents broken links like /trials instead of /research/trials.
 *
 * Run: npx vitest run src/__tests__/routes.test.ts
 */
import { describe, it, expect } from "vitest"
import { execSync } from "child_process"
import path from "path"

const SRC_DIR = path.resolve(__dirname, "..")

/** Extract all route paths from route definition files */
function getDefinedRoutes(): Set<string> {
  const routes = new Set<string>()

  // Static top-level routes from App.tsx
  routes.add("/")
  routes.add("/clusterbusters")
  routes.add("/research")
  routes.add("/community")
  routes.add("/diagnostics")

  // ClusterBusters nested routes
  routes.add("/clusterbusters/compare")
  routes.add("/clusterbusters/methodology")
  routes.add("/clusterbusters/insights")
  routes.add("/clusterbusters/insights/:slug")
  routes.add("/clusterbusters/:slug")

  // Research nested routes
  routes.add("/research/papers")
  routes.add("/research/trials")
  routes.add("/research/insights/landscape")
  routes.add("/research/insights/evidence")
  routes.add("/research/category/:slug")

  return routes
}

/** Extract all Link `to=` targets from source files */
function getLinkTargets(): Array<{ path: string; file: string; line: number }> {
  const results: Array<{ path: string; file: string; line: number }> = []

  // Find all to="/..." and to={`/...`} patterns
  const output = execSync(
    `grep -rn 'to="\\/' ${SRC_DIR} --include="*.tsx" --exclude-dir="__tests__" || true`,
    { encoding: "utf-8" },
  )

  for (const line of output.split("\n").filter(Boolean)) {
    const match = line.match(/^(.+?):(\d+):.*to="(\/[^"]*)"/)
    if (match) {
      results.push({
        file: match[1].replace(SRC_DIR + "/", ""),
        line: parseInt(match[2]),
        path: match[3],
      })
    }
  }

  // Also find template literal links: to={`/...`}
  const output2 = execSync(
    `grep -rn 'to={\`\\/' ${SRC_DIR} --include="*.tsx" --exclude-dir="__tests__" || true`,
    { encoding: "utf-8" },
  )

  for (const line of output2.split("\n").filter(Boolean)) {
    const match = line.match(/^(.+?):(\d+):.*to=\{`(\/[^`]*)`\}/)
    if (match) {
      // Extract the static prefix before any ${} interpolation
      const fullPath = match[3]
      const staticPrefix = fullPath.split("$")[0].replace(/\?.*/, "")
      results.push({
        file: match[1].replace(SRC_DIR + "/", ""),
        line: parseInt(match[2]),
        path: staticPrefix,
      })
    }
  }

  return results
}

/** Check if a link path matches any defined route */
function matchesRoute(linkPath: string, routes: Set<string>): boolean {
  // Remove query params
  const clean = linkPath.split("?")[0]

  // Direct match
  if (routes.has(clean)) return true

  // Check dynamic route patterns
  for (const route of routes) {
    if (!route.includes(":")) continue
    const routeParts = route.split("/")
    const linkParts = clean.split("/")
    if (routeParts.length !== linkParts.length) continue
    const matches = routeParts.every(
      (part, i) => part.startsWith(":") || part === linkParts[i],
    )
    if (matches) return true
  }

  return false
}

describe("Internal link routing", () => {
  const routes = getDefinedRoutes()
  const links = getLinkTargets()

  it("should find internal links to test", () => {
    expect(links.length).toBeGreaterThan(0)
  })

  it("all Link targets should match a defined route", () => {
    const broken: string[] = []
    for (const link of links) {
      if (!matchesRoute(link.path, routes)) {
        broken.push(`${link.file}:${link.line} → ${link.path}`)
      }
    }
    if (broken.length > 0) {
      throw new Error(
        `Found ${broken.length} broken link(s):\n${broken.join("\n")}`,
      )
    }
  })
})
