/**
 * Backfills Site.path/depth for every existing site. Every site today has
 * parentSiteId: null (createSite never set it before this phase), so this
 * is a trivial `path: [site.id], depth: 0` write for all of them — but
 * written generically, walking parent-first (topological) via
 * computeSitePath from lib/sites, so it stays correct once createSite
 * starts accepting a parent.
 *
 * Idempotent: re-computes and re-writes every site's path/depth from its
 * current parentSiteId every run, so it's also the right thing to re-run
 * after moving a site (once that's supported) to fix up its subtree.
 *
 * Run with: npx tsx prisma/backfill-site-hierarchy-path.ts
 */
import { adminPrisma } from '../src/lib/db/admin-client';
import { computeSitePath, type SiteAncestor } from '../src/lib/sites';

const prisma = adminPrisma;

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true } });
  let updated = 0;

  for (const org of orgs) {
    const sites = await prisma.site.findMany({
      where: { organizationId: org.id },
      select: { id: true, parentSiteId: true, path: true, depth: true },
    });
    const byId = new Map(sites.map((s) => [s.id, s]));
    const resolved = new Map<string, { path: readonly string[]; depth: number }>();

    const resolve = (id: string, seen: Set<string> = new Set()): { path: readonly string[]; depth: number } => {
      const cached = resolved.get(id);
      if (cached) return cached;
      if (seen.has(id)) throw new Error(`Cycle detected reaching site ${id} — fix manually before re-running.`);
      seen.add(id);

      const site = byId.get(id);
      if (!site) throw new Error(`Site ${id} referenced as a parent but not found in org ${org.id}.`);

      let parent: SiteAncestor | null = null;
      if (site.parentSiteId) {
        const parentResolved = resolve(site.parentSiteId, seen);
        parent = { id: site.parentSiteId, path: parentResolved.path };
      }
      const result = computeSitePath(id, parent);
      resolved.set(id, result);
      return result;
    };

    for (const site of sites) {
      const { path, depth } = resolve(site.id);
      const pathArr = [...path];
      const changed = site.depth !== depth || site.path.length !== pathArr.length || site.path.some((p, i) => p !== pathArr[i]);
      if (changed) {
        await prisma.site.update({ where: { id: site.id }, data: { path: pathArr, depth } });
        updated++;
      }
    }
  }

  console.log(`Backfilled path/depth for ${updated} site(s) that needed it.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
