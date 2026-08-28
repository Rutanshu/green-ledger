export interface NextTopic {
  slug: string;
  title: string;
  tag: string;
  body: string;
  why: string;
}

export const NEXT_TOPICS: NextTopic[] = [
  {
    slug: "lca",
    title: "Life Cycle Assessment (LCA)",
    tag: "Cradle to grave",
    body: "Where Scope 3 asks \"what emissions are connected to my business,\" an LCA asks a narrower, deeper question about one product: every environmental impact it has, from raw material extraction through manufacturing, use, and disposal — not just carbon, but water, land use, and resource depletion too.",
    why: "Increasingly requested by customers and regulators for specific high-impact products, and the methodology behind Scope 3 Category 11 (use of sold products) borrows heavily from LCA thinking.",
  },
  {
    slug: "product-passport",
    title: "Digital Product Passport (DPP)",
    tag: "EU Ecodesign Regulation",
    body: "A structured, machine-readable record attached to a product — its materials, its carbon footprint, its repairability, where it came from — accessible via a QR code or similar, so the information travels with the product through its whole life, including resale and recycling.",
    why: "Mandatory for an expanding list of product categories under the EU's Ecodesign for Sustainable Products Regulation, starting with batteries and textiles. It turns product-level emissions data — the kind an LCA produces — into something a customer can actually see.",
  },
  {
    slug: "recs",
    title: "Renewable Energy Certificates (RECs)",
    tag: "Market-based Scope 2",
    body: "A tradable certificate proving one megawatt-hour of electricity came from a renewable source. Buying and retiring RECs is exactly what lets a company report a lower market-based Scope 2 figure than its location-based one — the certificate is the paper trail behind that claim.",
    why: "Already the mechanism behind Scope 2's market-based / location-based split — the concept most directly connected to what this platform already calculates.",
  },
  {
    slug: "cbam",
    title: "Carbon Border Adjustment Mechanism (CBAM)",
    tag: "EU import carbon pricing",
    body: "A carbon price applied at the EU border to imports of certain goods — cement, steel, aluminium, fertilisers, electricity, hydrogen — matching what an EU producer would have paid under the EU Emissions Trading System, so imported goods don't undercut domestic ones on carbon cost alone.",
    why: "Requires the same embedded-emissions data an LCA or a detailed Scope 3 upstream calculation produces, reported per shipment rather than per year.",
  },
  {
    slug: "carbon-pricing",
    title: "Internal Carbon Pricing",
    tag: "Decision-making tool",
    body: "A company sets its own price per tonne of CO2e and applies it internally — to capital investment decisions, to internal budgets, sometimes to individual business units — so carbon cost shows up in decisions long before any external tax or scheme would force it to.",
    why: "Turns a completed emissions inventory from a compliance exercise into an input for actual business decisions — the natural next step once the numbers are trustworthy.",
  },
  {
    slug: "nature",
    title: "Nature & Biodiversity Reporting (TNFD)",
    tag: "Beyond carbon",
    body: "The Taskforce on Nature-related Financial Disclosures extends the same logic CSRD applies to climate — structured, comparable, audited disclosure — to a company's dependencies and impacts on nature: water use, land use, biodiversity loss.",
    why: "The reporting discipline is the same one this platform already builds for emissions: traceable data, defined boundaries, independent review — just applied to a wider set of environmental measures.",
  },
] as const;
