export interface ScopeCategory {
  code: string;
  n: number;
  title: string;
  body: string;
  examples: string[];
}

export interface ScopeDetail {
  n: 1 | 2 | 3;
  label: string;
  short: string;
  intro: string;
  points: Array<{ title: string; body: string }>;
  categories?: ScopeCategory[];
}

export const SCOPES: ScopeDetail[] = [
  {
    n: 1,
    label: "Scope 1",
    short: "What you burn yourself",
    intro:
      "Direct emissions from sources your company owns or controls. If you're the one lighting the fire — literally or through a piece of equipment you own — it's Scope 1.",
    points: [
      {
        title: "Stationary combustion",
        body: "Fuel burned in fixed equipment: a gas boiler heating an office, a diesel generator backing up a data centre, a furnace running a process line.",
      },
      {
        title: "Mobile combustion",
        body: "Fuel burned in vehicles and mobile plant your company controls — a delivery fleet, a forklift, a company car.",
      },
      {
        title: "Fugitive emissions",
        body: "Gases that leak rather than burn — refrigerant topped up in a chiller or an air-conditioning unit, most commonly HFCs with a very high warming potential per kilogram.",
      },
      {
        title: "Process emissions",
        body: "Emissions from a chemical or physical process itself, not from burning fuel to power it — cement calcination and metal smelting are the classic examples, though most companies outside heavy industry won't have any.",
      },
    ],
  },
  {
    n: 2,
    label: "Scope 2",
    short: "What you buy",
    intro:
      "Emissions from energy you buy, generated somewhere else. You didn't burn anything — but the power station that made your electricity did.",
    points: [
      {
        title: "Purchased electricity",
        body: "The largest Scope 2 source for most companies. Reported on two bases side by side, not blended into one number.",
      },
      {
        title: "Location-based",
        body: "The average emissions intensity of the grid you're actually plugged into — a fixed regional or national factor, the same for every company on that grid.",
      },
      {
        title: "Market-based",
        body: "Reflects the specific contracts you've signed — a renewable-energy certificate or a supplier-specific tariff can lower this number even when the grid factor hasn't moved.",
      },
      {
        title: "Purchased heat, steam, and cooling",
        body: "The same buy-don't-burn logic extended past electricity — district heating, steam piped in from a neighbouring plant, purchased chilled water.",
      },
    ],
  },
  {
    n: 3,
    label: "Scope 3",
    short: "Everything else in the chain",
    intro:
      "Every emission connected to your business that isn't Scope 1 or 2 — your suppliers, your logistics, your employees' commutes, what happens to your product after you sell it. For most companies, this is the largest number by far, and the hardest to measure.",
    points: [
      {
        title: "Upstream",
        body: "Everything that happens before your product reaches you — categories 1 through 8.",
      },
      {
        title: "Downstream",
        body: "Everything that happens after you sell it — categories 9 through 15.",
      },
      {
        title: "Materiality, not completeness",
        body: "The GHG Protocol doesn't expect every company to report all 15 categories in full — it expects you to identify which ones are actually material to your business and go deep there.",
      },
    ],
    categories: [
      { code: "scope3_cat_1", n: 1, title: "Purchased goods and services", body: "Emissions embedded in everything you buy to run the business — raw materials, components, packaging, office supplies — from the point of extraction through to your door.", examples: ["Raw materials for manufacturing", "Packaging", "IT hardware"] },
      { code: "scope3_cat_2", n: 2, title: "Capital goods", body: "The same idea as category 1, but for long-life assets rather than consumables — buildings, machinery, vehicles you purchase and depreciate over years.", examples: ["A new production line", "A company vehicle", "Office fit-out"] },
      { code: "scope3_cat_3", n: 3, title: "Fuel- and energy-related activities", body: "The emissions behind your Scope 1 and 2 numbers that aren't counted there — extracting and refining the fuel you burn, and the losses in the grid that delivers your electricity.", examples: ["Well-to-tank emissions for your diesel", "Transmission and distribution losses on purchased power"] },
      { code: "scope3_cat_4", n: 4, title: "Upstream transportation and distribution", body: "Moving goods to you — freight and logistics paid for by your suppliers or by you, before the goods arrive.", examples: ["Inbound freight from a supplier", "Third-party warehousing before delivery"] },
      { code: "scope3_cat_5", n: 5, title: "Waste generated in operations", body: "What happens to the waste your own operations produce, once it leaves your site — landfill, incineration, recycling.", examples: ["General waste to landfill", "Recycled packaging waste"] },
      { code: "scope3_cat_6", n: 6, title: "Business travel", body: "Employee travel for business purposes in vehicles you don't own — flights, trains, hotel stays, rental cars.", examples: ["Short-haul flights", "Client-site train travel", "Hotel nights"] },
      { code: "scope3_cat_7", n: 7, title: "Employee commuting", body: "How your employees get to work, and increasingly, working from home — often estimated from headcount and typical commute patterns rather than measured directly.", examples: ["Car commuting", "Public transport", "Home-working energy use"] },
      { code: "scope3_cat_8", n: 8, title: "Upstream leased assets", body: "Assets you lease FROM someone else, operated as part of your business — if you don't already count them in Scope 1/2 as if you owned them.", examples: ["A leased warehouse", "Leased IT equipment"] },
      { code: "scope3_cat_9", n: 9, title: "Downstream transportation and distribution", body: "Moving your sold goods onward, after they leave your control — transport and distribution you didn't pay for directly.", examples: ["Retail distribution of your product", "Customer collection logistics"] },
      { code: "scope3_cat_10", n: 10, title: "Processing of sold products", body: "For companies that sell intermediate goods — the emissions from a customer processing what you sold them into something else.", examples: ["A steel producer's coil, later stamped into car parts"] },
      { code: "scope3_cat_11", n: 11, title: "Use of sold products", body: "Often the single largest category for manufacturers of energy-using products — the emissions from your product being used, over its whole working life.", examples: ["Fuel burned by a vehicle you manufactured", "Electricity used by an appliance you sold"] },
      { code: "scope3_cat_12", n: 12, title: "End-of-life of sold products", body: "What happens when your product is eventually thrown away — disposal, recycling, or incineration.", examples: ["Landfill of a discarded product", "Recycling of packaging you sold"] },
      { code: "scope3_cat_13", n: 13, title: "Downstream leased assets", body: "Assets you own but lease OUT to someone else to operate — the mirror image of category 8.", examples: ["A building you own, leased to a tenant"] },
      { code: "scope3_cat_14", n: 14, title: "Franchises", body: "For franchisors — the operational emissions of franchisees running under your brand, which you don't directly control day to day.", examples: ["Energy use at a franchised retail outlet"] },
      { code: "scope3_cat_15", n: 15, title: "Investments", body: "For companies that hold equity or debt in other companies — a share of the investee's own emissions, proportional to your stake. Usually the material category for financial institutions.", examples: ["A bank's share of a portfolio company's Scope 1 and 2", "Equity investments in other businesses"] },
    ],
  },
];
