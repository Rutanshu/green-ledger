/**
 * Seed content, separated from the Prisma writes so it can be unit-tested
 * without a database. THIS IS THE DEMO — an empty product demos terribly.
 *
 * Deliberately industry-neutral: a manufacturer, an office, a warehouse and a
 * data centre. No vertical assumptions anywhere.
 */

export const GWP_AR6 = [
  { gas: 'CO2', gwp100: '1' },
  { gas: 'CH4', gwp100: '27.9' },
  { gas: 'N2O', gwp100: '273' },
  { gas: 'CO2E_BLENDED', gwp100: '1' },
] as const;

/** One neutral starter library. Every entry is renamable; orgs add their own. */
export const ASSET_TYPES = [
  { code: 'diesel_generator', label: 'Diesel generator',   category: 'STATIONARY_COMBUSTION', fuel: 'diesel',       unitDim: 'VOLUME' },
  { code: 'gas_boiler',       label: 'Gas boiler',         category: 'STATIONARY_COMBUSTION', fuel: 'natural_gas',  unitDim: 'VOLUME' },
  { code: 'oil_boiler',       label: 'Oil boiler',         category: 'STATIONARY_COMBUSTION', fuel: 'furnace_oil',  unitDim: 'VOLUME' },
  { code: 'lpg_appliance',    label: 'LPG appliance',      category: 'STATIONARY_COMBUSTION', fuel: 'lpg',          unitDim: 'MASS' },
  { code: 'chiller',          label: 'Chiller',            category: 'REFRIGERATION',         fuel: 'r410a',        unitDim: 'MASS' },
  { code: 'split_ac',         label: 'Split air-conditioner', category: 'REFRIGERATION',      fuel: 'r32',          unitDim: 'MASS' },
  { code: 'fleet_vehicle',    label: 'Fleet vehicle',      category: 'MOBILE_COMBUSTION',     fuel: 'diesel',       unitDim: 'VOLUME' },
  { code: 'forklift',         label: 'Forklift',           category: 'MOBILE_COMBUSTION',     fuel: 'lpg',          unitDim: 'MASS' },
  { code: 'process_oven',     label: 'Process oven',       category: 'PROCESS',               fuel: 'natural_gas',  unitDim: 'VOLUME' },
  { code: 'paint_booth',      label: 'Paint booth',        category: 'PROCESS',               fuel: 'solvent_voc',  unitDim: 'MASS' },
  { code: 'air_compressor',   label: 'Air compressor',     category: 'ELECTRICAL',            fuel: null,           unitDim: 'ENERGY' },
  { code: 'ups_system',       label: 'UPS system',         category: 'IT_EQUIPMENT',          fuel: null,           unitDim: 'ENERGY' },
  { code: 'server_rack',      label: 'Server rack',        category: 'IT_EQUIPMENT',          fuel: null,           unitDim: 'ENERGY' },
  { code: 'rooftop_solar',    label: 'Rooftop solar',      category: 'ON_SITE_GENERATION',    fuel: null,           unitDim: 'ENERGY' },
  { code: 'waste_compactor',  label: 'Waste compactor',    category: 'WASTE_HANDLING',        fuel: null,           unitDim: 'MASS' },
] as const;

export const SITE_TYPES = [
  { code: 'MANUFACTURING', label: 'Manufacturing plant' },
  { code: 'OFFICE',        label: 'Office' },
  { code: 'WAREHOUSE',     label: 'Warehouse' },
  { code: 'DATA_CENTRE',   label: 'Data centre' },
  { code: 'RETAIL',        label: 'Retail' },
  { code: 'LOGISTICS',     label: 'Logistics hub' },
  { code: 'LAB',           label: 'Laboratory' },
  { code: 'MIXED_USE',     label: 'Mixed use' },
  { code: 'OTHER',         label: 'Other' },
] as const;

/** Real published values. Cite them properly — this is the whole point of the product. */
export const DEFRA_2026 = {
  publisher: 'DEFRA', name: 'UK Government GHG Conversion Factors', version: '2026 v1.1',
  publishedOn: '2026-01-01', regionScope: 'GLOBAL', licence: 'Open Government Licence v3.0',
  sourceUrl: 'https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting',
  factors: [
    { scope: 'SCOPE_1', activityType: 'STATIONARY_COMBUSTION', method: 'FUEL_BASED', fuel: 'diesel',        region: 'GLOBAL', value: '2.68000',   num: 'KG_CO2E', den: 'L',        cite: 'Fuels, Table 5' },
    { scope: 'SCOPE_1', activityType: 'STATIONARY_COMBUSTION', method: 'FUEL_BASED', fuel: 'natural_gas',   region: 'GLOBAL', value: '2.02135',   num: 'KG_CO2E', den: 'M3',       cite: 'Fuels, Table 2' },
    { scope: 'SCOPE_1', activityType: 'STATIONARY_COMBUSTION', method: 'FUEL_BASED', fuel: 'furnace_oil',   region: 'GLOBAL', value: '3.17493',   num: 'KG_CO2E', den: 'L',        cite: 'Fuels, Table 5' },
    { scope: 'SCOPE_1', activityType: 'STATIONARY_COMBUSTION', method: 'FUEL_BASED', fuel: 'lpg',           region: 'GLOBAL', value: '2.93934',   num: 'KG_CO2E', den: 'KG',       cite: 'Fuels, Table 3' },
    { scope: 'SCOPE_1', activityType: 'MOBILE_COMBUSTION',     method: 'FUEL_BASED', fuel: 'diesel',        region: 'GLOBAL', value: '2.65590',   num: 'KG_CO2E', den: 'L',        cite: 'Vehicles, Table 6' },
    { scope: 'SCOPE_1', activityType: 'MOBILE_COMBUSTION',     method: 'FUEL_BASED', fuel: 'lpg',           region: 'GLOBAL', value: '1.55709',   num: 'KG_CO2E', den: 'L',        cite: 'Vehicles, Table 6' },
    { scope: 'SCOPE_1', activityType: 'FUGITIVE',              method: 'MATERIAL_BASED', fuel: 'r410a',     region: 'GLOBAL', value: '2255.50000', num: 'KG_CO2E', den: 'KG',      cite: 'Refrigerants — IPCC AR6 GWP100' },
    { scope: 'SCOPE_1', activityType: 'FUGITIVE',              method: 'MATERIAL_BASED', fuel: 'r32',       region: 'GLOBAL', value: '771.00000',  num: 'KG_CO2E', den: 'KG',      cite: 'Refrigerants — IPCC AR6 GWP100' },
    { scope: 'SCOPE_1', activityType: 'PROCESS',               method: 'MATERIAL_BASED', fuel: 'solvent_voc', region: 'GLOBAL', value: '2.41000', num: 'KG_CO2E', den: 'KG',      cite: 'Process materials, Table 11' },
    { scope: 'SCOPE_3', activityType: 'WASTE',   method: 'WASTE_TYPE_SPECIFIC', fuel: 'waste_landfill_mixed', region: 'GLOBAL', value: '0.58680', num: 'KG_CO2E', den: 'KG',      cite: 'Waste disposal, Table 14', cat: 5 },
    { scope: 'SCOPE_3', activityType: 'WASTE',   method: 'WASTE_TYPE_SPECIFIC', fuel: 'waste_recycled_mixed', region: 'GLOBAL', value: '0.02110', num: 'KG_CO2E', den: 'KG',      cite: 'Waste disposal, Table 14', cat: 5 },
    { scope: 'SCOPE_3', activityType: 'DISTANCE', method: 'DISTANCE_BASED', fuel: 'air_short_haul',        region: 'GLOBAL', value: '0.15600',   num: 'KG_CO2E', den: 'PASSENGER_KM', cite: 'Business travel — air, Table 7', cat: 6 },
    { scope: 'SCOPE_3', activityType: 'DISTANCE', method: 'DISTANCE_BASED', fuel: 'rail_national',         region: 'GLOBAL', value: '0.03546',   num: 'KG_CO2E', den: 'PASSENGER_KM', cite: 'Business travel — land, Table 8', cat: 6 },
    { scope: 'SCOPE_3', activityType: 'MASS',     method: 'DISTANCE_BASED', fuel: 'hgv_average',           region: 'GLOBAL', value: '0.10749',   num: 'KG_CO2E', den: 'TONNE_KM', cite: 'Freighting goods, Table 9', cat: 4 },
    { scope: 'SCOPE_3', activityType: 'SPEND',    method: 'SPEND_BASED', fuel: 'raw_materials',            region: 'GB',     value: '0.34000',   num: 'KG_CO2E', den: 'GBP',      cite: 'Indicative EEIO — placeholder', cat: 1 },
  ],
} as const;

export const GRID_2026 = {
  publisher: 'GRID_OPERATOR', name: 'UK Grid Carbon Intensity', version: 'v2026.1',
  publishedOn: '2026-01-01', regionScope: 'GB', licence: 'CC BY 4.0',
  sourceUrl: 'https://www.nationalgrideso.com/',
  factors: [
    { scope: 'SCOPE_2', activityType: 'PURCHASED_ELECTRICITY', method: 'AVERAGE_DATA', fuel: 'grid_electricity', region: 'GB-NAT', value: '0.19338', num: 'KG_CO2E', den: 'KWH', cite: 'Annual average grid intensity', basis: 'LOCATION_BASED' },
    { scope: 'SCOPE_2', activityType: 'PURCHASED_ELECTRICITY', method: 'SUPPLIER_SPECIFIC', fuel: 'grid_electricity', region: 'GB-NAT', value: '0.14200', num: 'KG_CO2E', den: 'KWH', cite: 'UK residual mix', basis: 'MARKET_BASED' },
  ],
} as const;

export const DEMO_SITES = [
  { code: 'MI-NG-01', name: 'Northgate Plant',     siteType: 'MANUFACTURING', city: 'Leeds',      country: 'GB', gridRegion: 'GB-NAT', floorAreaM2: '28400', headcountFte: '1180', denominators: { org_units_produced: 1420000 } },
  { code: 'MI-RO-02', name: 'Riverside Office',    siteType: 'OFFICE',        city: 'Leeds',      country: 'GB', gridRegion: 'GB-NAT', floorAreaM2: '4200',  headcountFte: '210',  denominators: {} },
  { code: 'MI-AD-04', name: 'Ashford Data Centre', siteType: 'DATA_CENTRE',   city: 'Ashford',    country: 'GB', gridRegion: 'GB-NAT', floorAreaM2: '1800',  headcountFte: '24',   denominators: { org_rack_kw: 640 } },
  { code: 'MI-CW-07', name: 'Central Warehouse',   siteType: 'WAREHOUSE',     city: 'Rugby',      country: 'GB', gridRegion: 'GB-NAT', floorAreaM2: '16000', headcountFte: '85',   denominators: { org_tonnes_shipped: 94000 } },
] as const;

export const DEMO_ASSETS: Record<string, ReadonlyArray<Record<string, unknown>>> = {
  'MI-NG-01': [
    { name: 'Backup generator DG-1', assetTypeCode: 'diesel_generator', category: 'STATIONARY_COMBUSTION', fuel: 'diesel',      capacity: '500', capacityNote: '500 kVA', commissionedOn: '2019-04-01', tagOrSerial: 'GEN-001', subLocation: 'Yard' },
    { name: 'Steam boiler B-2',      assetTypeCode: 'gas_boiler',       category: 'STATIONARY_COMBUSTION', fuel: 'natural_gas', capacityNote: '2 t/h steam', commissionedOn: '2016-11-01' },
    { name: 'Chiller CH-1',          assetTypeCode: 'chiller',          category: 'REFRIGERATION',         fuel: 'r410a',       refrigerantChargeKg: '120', quantity: 2, commissionedOn: '2021-02-01' },
    { name: 'Forklift fleet',        assetTypeCode: 'forklift',         category: 'MOBILE_COMBUSTION',     fuel: 'lpg',         quantity: 6 },
    { name: 'Paint booth PB-1',      assetTypeCode: 'paint_booth',      category: 'PROCESS',               fuel: 'solvent_voc', commissionedOn: '2020-05-01' },
    { name: 'Compressor house AC-1', assetTypeCode: 'air_compressor',   category: 'ELECTRICAL',            capacity: '250', capacityUnit: 'KWH', commissionedOn: '2018-06-01' },
    { name: 'Rooftop solar',         assetTypeCode: 'rooftop_solar',    category: 'ON_SITE_GENERATION',    capacityNote: '180 kWp', commissionedOn: '2023-08-01' },
    { name: 'Boiler B-1',            assetTypeCode: 'oil_boiler',       category: 'STATIONARY_COMBUSTION', fuel: 'furnace_oil', commissionedOn: '2009-03-01', decommissionedOn: '2025-11-30', status: 'DECOMMISSIONED' },
  ],
  'MI-RO-02': [
    { name: 'Office AC units',   assetTypeCode: 'split_ac',     category: 'REFRIGERATION',         fuel: 'r32', refrigerantChargeKg: '3.2', quantity: 14, commissionedOn: '2022-03-01' },
    { name: 'Pool cars',         assetTypeCode: 'fleet_vehicle', category: 'MOBILE_COMBUSTION',    fuel: 'diesel', quantity: 4 },
    { name: 'Comms room UPS',    assetTypeCode: 'ups_system',   category: 'IT_EQUIPMENT',          capacity: '20', capacityUnit: 'KWH' },
  ],
  'MI-AD-04': [
    { name: 'Hall A racks',      assetTypeCode: 'server_rack',  category: 'IT_EQUIPMENT',   capacity: '400', capacityUnit: 'KWH', quantity: 40 },
    { name: 'CRAC units',        assetTypeCode: 'chiller',      category: 'REFRIGERATION',  fuel: 'r410a', refrigerantChargeKg: '45', quantity: 6 },
    { name: 'Standby generator', assetTypeCode: 'diesel_generator', category: 'STATIONARY_COMBUSTION', fuel: 'diesel', capacityNote: '1.2 MVA', commissionedOn: '2020-09-01' },
  ],
  // deliberately empty — proves a site with no assets sits at 100%, not 0%
  'MI-CW-07': [],
};

/**
 * Labels the demo org has customised — so the Labels screen has something to show
 * the moment a visitor opens it.
 */
export const DEMO_LABELS = [
  { entityKind: 'ACTIVITY_TYPE', code: 'STATIONARY_COMBUSTION', scopeKey: 'org', label: 'Fixed fuel burning' },
  { entityKind: 'ACTIVITY_TYPE', code: 'STATIONARY_COMBUSTION', scopeKey: 'site_type:OFFICE', label: 'Building heating' },
  { entityKind: 'ACTIVITY_TYPE', code: 'MOBILE_COMBUSTION', scopeKey: 'org', label: 'Fleet & plant fuel' },
  { entityKind: 'SCOPE3_CATEGORY', code: 'scope3_cat_5', scopeKey: 'org', label: 'Site waste' },
  { entityKind: 'DATA_QUALITY', code: 'PROXY', scopeKey: 'org', label: 'Rough estimate' },
  { entityKind: 'ASSET_TYPE', code: 'chiller', scopeKey: 'org', label: 'Cooling unit' },
  { entityKind: 'UNIT', code: 'GAL_UK', scopeKey: 'org', label: 'UK gallons', isHidden: true },
] as const;

/** Org-defined intensity denominators — the highest-value open vocabulary. */
export const DEMO_DENOMINATORS = [
  { code: 'org_units_produced', label: 'Units produced' },
  { code: 'org_tonnes_shipped', label: 'Tonnes shipped' },
  { code: 'org_rack_kw',        label: 'Rack kW installed' },
] as const;

interface SeedQuestion {
  code: string; label: string; helpText?: string;
  unitDim?: string; allowedUnits?: string[]; inputType?: string;
  required?: boolean; visibleIf?: unknown;
  binding?: {
    scope: string; activityType: string; method: string; fuel: string;
    regionStrategy?: string; outputBasis?: string; cat?: number;
  } | null;
}

interface SeedSection { title: string; scope: string; cat?: number; questions: SeedQuestion[] }

const hasAsset = (fuel: string) => ({ site_has_asset: { fuelOrMaterialCode: fuel } });

export const DEMO_TEMPLATE: { name: string; sections: SeedSection[] } = {
  name: 'Standard Operations',
  sections: [
    {
      title: 'Fuel burned on site', scope: 'SCOPE_1',
      questions: [
        { code: 'diesel_qty', label: 'How much diesel did {{asset.name}} consume in {{period.label}}?',
          helpText: 'Add up your fuel delivery invoices for the period.',
          unitDim: 'VOLUME', allowedUnits: ['L', 'M3', 'GAL_UK'], visibleIf: hasAsset('diesel'),
          binding: { scope: 'SCOPE_1', activityType: 'STATIONARY_COMBUSTION', method: 'FUEL_BASED', fuel: 'diesel' } },
        { code: 'natural_gas_qty', label: 'How much natural gas did {{asset.name}} consume in {{period.label}}?',
          helpText: 'From your gas utility bills. Enter it in whatever unit the bill uses — we convert.',
          unitDim: 'VOLUME', allowedUnits: ['M3', 'L'], visibleIf: hasAsset('natural_gas'),
          binding: { scope: 'SCOPE_1', activityType: 'STATIONARY_COMBUSTION', method: 'FUEL_BASED', fuel: 'natural_gas' } },
        { code: 'used_furnace_oil', label: 'Did you use furnace oil at any point in {{period.label}}?',
          inputType: 'BOOLEAN', required: false, binding: null },
        { code: 'furnace_oil_qty', label: 'How much furnace oil did you use?',
          unitDim: 'VOLUME', allowedUnits: ['L'],
          visibleIf: { answer_equals: { question_code: 'used_furnace_oil', value: true } },
          binding: { scope: 'SCOPE_1', activityType: 'STATIONARY_COMBUSTION', method: 'FUEL_BASED', fuel: 'furnace_oil' } },
      ],
    },
    {
      title: 'Refrigerants and process materials', scope: 'SCOPE_1',
      questions: [
        { code: 'r410a_topup', label: 'How much R-410A was added to {{asset.name}} during {{period.label}}?',
          helpText: 'Top-up method: the mass ADDED during the year, from service records. Not the total charge.',
          unitDim: 'MASS', allowedUnits: ['KG', 'LB'], visibleIf: hasAsset('r410a'),
          binding: { scope: 'SCOPE_1', activityType: 'FUGITIVE', method: 'MATERIAL_BASED', fuel: 'r410a' } },
        { code: 'r32_topup', label: 'How much R-32 was added to {{asset.name}} during {{period.label}}?',
          unitDim: 'MASS', allowedUnits: ['KG'], visibleIf: hasAsset('r32'),
          binding: { scope: 'SCOPE_1', activityType: 'FUGITIVE', method: 'MATERIAL_BASED', fuel: 'r32' } },
        { code: 'solvent_qty', label: 'How much solvent was consumed in {{asset.name}} in {{period.label}}?',
          helpText: 'Purchase records, less anything recovered or returned for reprocessing.',
          unitDim: 'MASS', allowedUnits: ['KG', 'TONNE'], visibleIf: hasAsset('solvent_voc'),
          binding: { scope: 'SCOPE_1', activityType: 'PROCESS', method: 'MATERIAL_BASED', fuel: 'solvent_voc' } },
      ],
    },
    {
      title: 'Energy you buy', scope: 'SCOPE_2',
      questions: [
        { code: 'grid_electricity', label: 'How much grid electricity did this site use in {{period.label}}?',
          helpText: 'Total from your electricity bills. Exclude anything generated and used on site.',
          unitDim: 'ENERGY', allowedUnits: ['KWH', 'MWH'],
          binding: { scope: 'SCOPE_2', activityType: 'PURCHASED_ELECTRICITY', method: 'AVERAGE_DATA',
                     fuel: 'grid_electricity', regionStrategy: 'SITE_GRID_ONLY', outputBasis: 'DUAL' } },
        { code: 'buys_certificates', label: 'Did you buy renewable energy certificates (REGO / GO / REC) for this site?',
          inputType: 'BOOLEAN', required: false, binding: null },
        { code: 'certificates_mwh', label: 'How many MWh of certificates were retired for this site?',
          unitDim: 'ENERGY', allowedUnits: ['MWH', 'KWH'],
          visibleIf: { answer_equals: { question_code: 'buys_certificates', value: true } }, binding: null },
      ],
    },
    {
      title: 'Waste', scope: 'SCOPE_3', cat: 5,
      questions: [
        { code: 'waste_landfill', label: 'How much waste went to landfill from this site in {{period.label}}?',
          helpText: 'From your waste contractor’s duty-of-care returns.',
          unitDim: 'MASS', allowedUnits: ['KG', 'TONNE'],
          binding: { scope: 'SCOPE_3', activityType: 'WASTE', method: 'WASTE_TYPE_SPECIFIC', fuel: 'waste_landfill_mixed', cat: 5 } },
        { code: 'waste_recycled', label: 'How much waste was recycled from this site in {{period.label}}?',
          unitDim: 'MASS', allowedUnits: ['KG', 'TONNE'],
          binding: { scope: 'SCOPE_3', activityType: 'WASTE', method: 'WASTE_TYPE_SPECIFIC', fuel: 'waste_recycled_mixed', cat: 5 } },
      ],
    },
    {
      title: 'Business travel', scope: 'SCOPE_3', cat: 6,
      questions: [
        { code: 'air_travel_km', label: 'Total short-haul air travel by staff at this site',
          unitDim: 'PASSENGER_DISTANCE', allowedUnits: ['PASSENGER_KM'],
          binding: { scope: 'SCOPE_3', activityType: 'DISTANCE', method: 'DISTANCE_BASED', fuel: 'air_short_haul', cat: 6 } },
        { code: 'rail_travel_km', label: 'Total rail travel by staff at this site',
          unitDim: 'PASSENGER_DISTANCE', allowedUnits: ['PASSENGER_KM'], required: false,
          binding: { scope: 'SCOPE_3', activityType: 'DISTANCE', method: 'DISTANCE_BASED', fuel: 'rail_national', cat: 6 } },
      ],
    },
    {
      title: 'Purchased goods and services', scope: 'SCOPE_3', cat: 1,
      questions: [
        { code: 'raw_materials_spend', label: 'Total spend on raw materials at this site',
          helpText: 'A spend-based estimate. Replace with supplier-specific data when you have it.',
          unitDim: 'CURRENCY', allowedUnits: ['GBP'],
          binding: { scope: 'SCOPE_3', activityType: 'SPEND', method: 'SPEND_BASED', fuel: 'raw_materials', cat: 1 } },
        // deliberately BROKEN so the Factor Lab has something to show
        { code: 'cleaning_spend', label: 'Total spend on contract cleaning at this site',
          unitDim: 'CURRENCY', allowedUnits: ['GBP'], required: false,
          binding: { scope: 'SCOPE_3', activityType: 'SPEND', method: 'SPEND_BASED', fuel: 'cleaning_services', cat: 1 } },
      ],
    },
  ],
};

/** Realistic answers, so the demo looks finished rather than empty. */
export const DEMO_ANSWERS: Record<string, Record<string, { value: string; unit: string; quality: string }>> = {
  'MI-NG-01': {
    diesel_qty:          { value: '14200',   unit: 'L',   quality: 'MEASURED' },
    natural_gas_qty:     { value: '182400',  unit: 'M3',  quality: 'MEASURED' },
    r410a_topup:         { value: '42',      unit: 'KG',  quality: 'CALCULATED' },
    solvent_qty:         { value: '18400',   unit: 'KG',  quality: 'ESTIMATED' },
    grid_electricity:    { value: '4802000', unit: 'KWH', quality: 'MEASURED' },
    waste_landfill:      { value: '186000',  unit: 'KG',  quality: 'MEASURED' },
    raw_materials_spend: { value: '8420000', unit: 'GBP', quality: 'MEASURED' },
    // waste_recycled and air_travel_km left blank ON PURPOSE — the dashboard needs a
    // site mid-progress, and the Scope 3 bar needs a visible gap to chase.
  },
  'MI-RO-02': {
    r32_topup:        { value: '4.6',    unit: 'KG',  quality: 'ESTIMATED' },
    grid_electricity: { value: '386000', unit: 'KWH', quality: 'MEASURED' },
    waste_landfill:   { value: '22000',  unit: 'KG',  quality: 'ESTIMATED' },
  },
  'MI-AD-04': {
    diesel_qty:       { value: '3100',    unit: 'L',   quality: 'MEASURED' },
    r410a_topup:      { value: '12',      unit: 'KG',  quality: 'CALCULATED' },
    grid_electricity: { value: '5610000', unit: 'KWH', quality: 'MEASURED' },
    waste_landfill:   { value: '4100',    unit: 'KG',  quality: 'ESTIMATED' },
    waste_recycled:   { value: '9800',    unit: 'KG',  quality: 'MEASURED' },
    air_travel_km:    { value: '31000',   unit: 'PASSENGER_KM', quality: 'ESTIMATED' },
    raw_materials_spend: { value: '210000', unit: 'GBP', quality: 'ESTIMATED' },
  },
  // MI-CW-07 deliberately untouched — the dashboard needs a "not started" row
  'MI-CW-07': {},
};
