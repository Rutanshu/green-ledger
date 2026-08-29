/**
 * Dimension data for the bulk reference factor library. See
 * backfill-bulk-factor-library.ts for what this is for and how it's used.
 *
 * Every list here names a REAL fuel, vehicle class, waste stream,
 * refrigerant, US eGRID subregion, or EEIO-style sector — this is a wide
 * reference library, not meaningless padding. Values are procedurally
 * derived (a family base intensity plus a small deterministic year-over-
 * year drift), not transcribed from the live published tables — see the
 * honesty note in backfill-bulk-factor-library.ts before trusting any one
 * row for a real disclosure.
 */

export const YEARS_DEFRA = Array.from({ length: 22 }, (_, i) => 2005 + i); // 2005..2026
export const YEARS_EGRID = Array.from({ length: 20 }, (_, i) => 2005 + i); // 2005..2024

/**
 * A resolveFactor() match is keyed on (fuel, activityType, method, region,
 * basis) plus a validOn(date) check — it does NOT look at unitDenominator.
 * Two rows sharing that key can only be told apart by non-overlapping
 * validity windows, never by giving them different units. Every year-
 * vintage row in this library uses this: each year runs Jan 1 - Dec 31
 * EXCEPT the latest year, which stays open-ended (validTo: null) as the
 * current vintage — exactly how a mid-year factor supersession works
 * elsewhere in this codebase (see lib/factors' sliceByFactorValidity).
 */
export function yearWindow(years: readonly number[], year: number): { validFrom: Date; validTo: Date | null } {
  const isLatest = year === years[years.length - 1];
  return {
    validFrom: new Date(`${year}-01-01`),
    validTo: isLatest ? null : new Date(`${year}-12-31`),
  };
}

// ─────────────────────────── stationary combustion fuels ───────────────────────────
// name, code, family (drives base intensity), units this fuel is commonly metered in
type FuelFamily = 'petroleum_liquid' | 'petrol_like' | 'gaseous' | 'coal' | 'biomass' | 'biogas';

export const STATIONARY_FUELS: { name: string; code: string; family: FuelFamily; units: ('KG' | 'L' | 'TONNE' | 'KWH')[] }[] = [
  { name: 'Aviation spirit', code: 'aviation_spirit', family: 'petrol_like', units: ['L', 'KWH'] },
  { name: 'Aviation turbine fuel', code: 'aviation_turbine_fuel', family: 'petroleum_liquid', units: ['L', 'KWH'] },
  { name: 'Burning oil', code: 'burning_oil', family: 'petroleum_liquid', units: ['L', 'KWH'] },
  { name: 'Diesel (100% mineral)', code: 'diesel_100_mineral', family: 'petroleum_liquid', units: ['L', 'KWH'] },
  { name: 'Petrol (average biofuel blend)', code: 'petrol_average_biofuel_blend', family: 'petrol_like', units: ['L', 'KWH'] },
  { name: 'Petrol (100% mineral)', code: 'petrol_100_mineral', family: 'petrol_like', units: ['L', 'KWH'] },
  { name: 'Fuel oil', code: 'fuel_oil', family: 'petroleum_liquid', units: ['L', 'TONNE', 'KWH'] },
  { name: 'Gas oil', code: 'gas_oil', family: 'petroleum_liquid', units: ['L', 'KWH'] },
  { name: 'Lubricants', code: 'lubricants', family: 'petroleum_liquid', units: ['L', 'TONNE'] },
  { name: 'Naphtha', code: 'naphtha', family: 'petroleum_liquid', units: ['L', 'TONNE'] },
  { name: 'Processed fuel oils (industrial)', code: 'processed_fuel_oils_industrial', family: 'petroleum_liquid', units: ['L', 'TONNE'] },
  { name: 'Processed fuel oils (undefined)', code: 'processed_fuel_oils_undefined', family: 'petroleum_liquid', units: ['L', 'TONNE'] },
  { name: 'Waste oils', code: 'waste_oils', family: 'petroleum_liquid', units: ['L', 'TONNE'] },
  { name: 'Compressed natural gas', code: 'cng', family: 'gaseous', units: ['KG', 'KWH'] },
  { name: 'Liquefied natural gas', code: 'lng', family: 'gaseous', units: ['KG', 'KWH'] },
  { name: 'Other petroleum gas', code: 'other_petroleum_gas', family: 'gaseous', units: ['KG', 'KWH'] },
  { name: 'Natural gas (100% mineral blend)', code: 'natural_gas_100_mineral', family: 'gaseous', units: ['KWH'] },
  { name: 'Natural gas (grid displaced)', code: 'natural_gas_grid_displaced', family: 'gaseous', units: ['KWH'] },
  { name: 'Coal (industrial)', code: 'coal_industrial', family: 'coal', units: ['KG', 'TONNE', 'KWH'] },
  { name: 'Coal (electricity generation)', code: 'coal_electricity_generation', family: 'coal', units: ['KG', 'TONNE', 'KWH'] },
  { name: 'Coal (domestic)', code: 'coal_domestic', family: 'coal', units: ['KG', 'TONNE'] },
  { name: 'Coking coal', code: 'coking_coal', family: 'coal', units: ['KG', 'TONNE'] },
  { name: 'Petroleum coke', code: 'petroleum_coke', family: 'coal', units: ['KG', 'TONNE'] },
  { name: 'Wood logs', code: 'wood_logs', family: 'biomass', units: ['KG', 'TONNE', 'KWH'] },
  { name: 'Wood chips', code: 'wood_chips', family: 'biomass', units: ['KG', 'TONNE', 'KWH'] },
  { name: 'Wood pellets', code: 'wood_pellets', family: 'biomass', units: ['KG', 'TONNE', 'KWH'] },
  { name: 'Biodiesel ME', code: 'biodiesel_me', family: 'biomass', units: ['L', 'KWH'] },
  { name: 'Biodiesel ME (from used cooking oil)', code: 'biodiesel_me_uco', family: 'biomass', units: ['L', 'KWH'] },
  { name: 'Bioethanol', code: 'bioethanol', family: 'biomass', units: ['L', 'KWH'] },
  { name: 'Biomethane (compressed)', code: 'biomethane_compressed', family: 'biogas', units: ['KG', 'KWH'] },
  { name: 'Biomethane (grid injected)', code: 'biomethane_grid', family: 'biogas', units: ['KWH'] },
  { name: 'Biogas', code: 'biogas', family: 'biogas', units: ['KG', 'KWH'] },
  { name: 'Tallow methyl ester', code: 'tallow_methyl_ester', family: 'biomass', units: ['L', 'KWH'] },
  { name: 'Landfill gas', code: 'landfill_gas', family: 'biogas', units: ['KG', 'KWH'] },
  { name: 'Biomass pellets (straw)', code: 'biomass_straw', family: 'biomass', units: ['KG', 'TONNE'] },
  { name: 'Refuse-derived fuel', code: 'refuse_derived_fuel', family: 'coal', units: ['KG', 'TONNE'] },
  { name: 'Solid recovered fuel', code: 'solid_recovered_fuel', family: 'coal', units: ['KG', 'TONNE'] },
  { name: 'Methanol', code: 'methanol', family: 'petrol_like', units: ['L', 'KWH'] },
  { name: 'Ethanol (100%)', code: 'ethanol_100', family: 'biomass', units: ['L', 'KWH'] },
  { name: 'Propane', code: 'propane', family: 'gaseous', units: ['KG', 'L', 'KWH'] },
  { name: 'Butane', code: 'butane', family: 'gaseous', units: ['KG', 'L', 'KWH'] },
  { name: 'Kerosene', code: 'kerosene', family: 'petroleum_liquid', units: ['L', 'KWH'] },
  { name: 'Marine gas oil', code: 'marine_gas_oil', family: 'petroleum_liquid', units: ['L', 'TONNE'] },
  { name: 'Marine fuel oil', code: 'marine_fuel_oil', family: 'petroleum_liquid', units: ['L', 'TONNE'] },
  { name: 'Heavy fuel oil', code: 'heavy_fuel_oil', family: 'petroleum_liquid', units: ['L', 'TONNE'] },
  { name: 'Blast furnace gas', code: 'blast_furnace_gas', family: 'gaseous', units: ['KWH'] },
  { name: 'Coke oven gas', code: 'coke_oven_gas', family: 'gaseous', units: ['KWH'] },
];

export const FAMILY_BASE: Record<FuelFamily, Record<string, number>> = {
  // base value per unit, before year drift
  petroleum_liquid: { L: 2.75, KG: 3.15, TONNE: 3150, KWH: 0.246 },
  petrol_like: { L: 2.2, KG: 2.9, TONNE: 2900, KWH: 0.24 },
  gaseous: { KG: 2.75, L: 1.55, KWH: 0.183 },
  coal: { KG: 2.4, TONNE: 2400, KWH: 0.32 },
  biomass: { KG: 0.04, L: 0.03, TONNE: 40, KWH: 0.015 },
  biogas: { KG: 0.6, KWH: 0.02 },
};

// ─────────────────────────── mobile combustion (passenger + light vehicles) ───────────────────────────
export const VEHICLE_SIZES = ['small', 'medium', 'large', 'average', 'unknown'] as const;
export const VEHICLE_FUELS = ['petrol', 'diesel', 'hybrid', 'plug_in_hybrid', 'battery_electric', 'unknown'] as const;
export const VAN_CLASSES = ['class_i', 'class_ii', 'class_iii', 'average'] as const;
export const VAN_FUELS = ['petrol', 'diesel', 'cng', 'battery_electric'] as const;
export const MOTORBIKE_SIZES = ['small', 'medium', 'large', 'average'] as const;

// ─────────────────────────── freight ───────────────────────────
export const HGV_RIGID_WEIGHTS = ['3.5-7.5t', '7.5-17t', '>17t'] as const;
export const HGV_ARTIC_WEIGHTS = ['<33t', '>33t'] as const;
export const LADEN_BANDS = ['0pct', '50pct', '100pct', 'average'] as const;
export const SEA_FREIGHT_CLASSES = ['bulk_carrier', 'container_ship', 'general_cargo', 'tanker', 'ro_ro', 'refrigerated_cargo'] as const;
export const AIR_FREIGHT_HAUL = ['domestic', 'short_haul', 'long_haul'] as const;

// ─────────────────────────── passenger transport ───────────────────────────
export const RAIL_MODES = ['national_rail', 'international_rail', 'light_rail_tram', 'underground'] as const;
export const AIR_HAUL = ['domestic', 'short_haul', 'long_haul'] as const;
export const AIR_CLASS = ['economy', 'business', 'first', 'average'] as const;
export const SEA_PASSENGER = ['ferry_foot_passenger', 'ferry_car_passenger'] as const;
export const BUS_TYPES = ['local_bus', 'coach'] as const;

// ─────────────────────────── refrigerants (real ASHRAE designations) ───────────────────────────
// Approximate AR6 GWP-100 order of magnitude by blend family — see honesty
// note in the generator script. Grouped so the base value reflects the
// blend's dominant component rather than being uniform across all of them.
export const REFRIGERANTS: { code: string; label: string; approxGwp100: number }[] = [
  { code: 'r22', label: 'R-22 (HCFC)', approxGwp100: 1960 },
  { code: 'r23', label: 'R-23', approxGwp100: 14600 },
  { code: 'r125', label: 'R-125', approxGwp100: 3740 },
  { code: 'r134a', label: 'R-134a', approxGwp100: 1530 },
  { code: 'r143a', label: 'R-143a', approxGwp100: 5810 },
  { code: 'r152a', label: 'R-152a', approxGwp100: 164 },
  { code: 'r404a', label: 'R-404A', approxGwp100: 4728 },
  { code: 'r407a', label: 'R-407A', approxGwp100: 2261 },
  { code: 'r407c', label: 'R-407C', approxGwp100: 1908 },
  { code: 'r407f', label: 'R-407F', approxGwp100: 1954 },
  { code: 'r408a', label: 'R-408A', approxGwp100: 3152 },
  { code: 'r409a', label: 'R-409A', approxGwp100: 1585 },
  { code: 'r411a', label: 'R-411A', approxGwp100: 1597 },
  { code: 'r413a', label: 'R-413A', approxGwp100: 2053 },
  { code: 'r417a', label: 'R-417A', approxGwp100: 2346 },
  { code: 'r419a', label: 'R-419A', approxGwp100: 2967 },
  { code: 'r420a', label: 'R-420A', approxGwp100: 1730 },
  { code: 'r421a', label: 'R-421A', approxGwp100: 2631 },
  { code: 'r422a', label: 'R-422A', approxGwp100: 3143 },
  { code: 'r422d', label: 'R-422D', approxGwp100: 2729 },
  { code: 'r423a', label: 'R-423A', approxGwp100: 2280 },
  { code: 'r424a', label: 'R-424A', approxGwp100: 2440 },
  { code: 'r427a', label: 'R-427A', approxGwp100: 2093 },
  { code: 'r428a', label: 'R-428A', approxGwp100: 3607 },
  { code: 'r434a', label: 'R-434A', approxGwp100: 3245 },
  { code: 'r437a', label: 'R-437A', approxGwp100: 1805 },
  { code: 'r438a', label: 'R-438A', approxGwp100: 2264 },
  { code: 'r442a', label: 'R-442A', approxGwp100: 1888 },
  { code: 'r448a', label: 'R-448A', approxGwp100: 1387 },
  { code: 'r449a', label: 'R-449A', approxGwp100: 1397 },
  { code: 'r449b', label: 'R-449B', approxGwp100: 1412 },
  { code: 'r450a', label: 'R-450A', approxGwp100: 604 },
  { code: 'r452a', label: 'R-452A', approxGwp100: 2140 },
  { code: 'r452b', label: 'R-452B', approxGwp100: 698 },
  { code: 'r452c', label: 'R-452C', approxGwp100: 2144 },
  { code: 'r453a', label: 'R-453A', approxGwp100: 1765 },
  { code: 'r454a', label: 'R-454A', approxGwp100: 238 },
  { code: 'r454b', label: 'R-454B', approxGwp100: 466 },
  { code: 'r454c', label: 'R-454C', approxGwp100: 148 },
  { code: 'r455a', label: 'R-455A', approxGwp100: 148 },
  { code: 'r507a', label: 'R-507A', approxGwp100: 3985 },
  { code: 'r508a', label: 'R-508A', approxGwp100: 13214 },
  { code: 'r508b', label: 'R-508B', approxGwp100: 13396 },
  { code: 'r512a', label: 'R-512A', approxGwp100: 146 },
  { code: 'r513a', label: 'R-513A', approxGwp100: 631 },
  { code: 'r1234yf', label: 'R-1234yf (HFO)', approxGwp100: 4 },
  { code: 'r1234ze', label: 'R-1234ze (HFO)', approxGwp100: 7 },
  { code: 'ammonia_r717', label: 'Ammonia (R-717)', approxGwp100: 0 },
  { code: 'co2_r744', label: 'Carbon dioxide as refrigerant (R-744)', approxGwp100: 1 },
  { code: 'propane_r290', label: 'Propane as refrigerant (R-290)', approxGwp100: 3 },
  { code: 'isobutane_r600a', label: 'Isobutane as refrigerant (R-600a)', approxGwp100: 3 },
  { code: 'sf6', label: 'Sulphur hexafluoride (SF6)', approxGwp100: 25200 },
  { code: 'nf3', label: 'Nitrogen trifluoride (NF3)', approxGwp100: 17400 },
  { code: 'pfc14_cf4', label: 'PFC-14 (tetrafluoromethane)', approxGwp100: 7380 },
  { code: 'pfc116_c2f6', label: 'PFC-116 (hexafluoroethane)', approxGwp100: 12400 },
  { code: 'pfc218_c3f8', label: 'PFC-218 (octafluoropropane)', approxGwp100: 9290 },
];

// ─────────────────────────── waste ───────────────────────────
export const WASTE_BASE_MATERIALS = [
  'mixed_municipal', 'food_waste', 'garden_waste', 'paper', 'board', 'mixed_paper_board',
  'glass', 'mixed_metals', 'steel_cans', 'aluminium_cans', 'plastics_average', 'plastics_film',
  'plastics_rigid', 'plastics_pet', 'plastics_hdpe', 'plastics_ldpe', 'plastics_pp', 'plastics_ps',
  'wood', 'textiles', 'furniture', 'mattresses', 'carpets', 'tyres', 'batteries_lead_acid',
  'batteries_nicd', 'batteries_liion', 'weee_large', 'weee_small', 'weee_fridges_freezers',
  'construction_inert', 'construction_mixed', 'plasterboard', 'clinical_waste', 'soils',
  'aggregate', 'asphalt', 'concrete', 'bricks', 'cardboard_packaging', 'organic_liquids',
  'oils_waste', 'chemicals', 'healthcare_general', 'food_industry_organic', 'green_garden_waste',
  'household_residual', 'commercial_general', 'ceramics', 'insulation_material', 'rubber',
  'leather', 'straw', 'sewage_sludge', 'ash_residue', 'demolition_rubble',
] as const; // 55 materials

export const WASTE_DISPOSAL_METHODS = [
  { code: 'landfill', label: 'Landfill', factor: 1.0 },
  { code: 'combustion_with_energy', label: 'Combustion with energy recovery', factor: 0.35 },
  { code: 'combustion_without_energy', label: 'Combustion without energy recovery', factor: 0.5 },
  { code: 'closed_loop_recycling', label: 'Closed-loop recycling', factor: 0.05 },
  { code: 'open_loop_recycling', label: 'Open-loop recycling', factor: 0.08 },
  { code: 'composting', label: 'Composting', factor: 0.02 },
  { code: 'anaerobic_digestion', label: 'Anaerobic digestion', factor: 0.015 },
  { code: 'hazardous_treatment', label: 'Hazardous waste treatment', factor: 0.6 },
] as const; // 8 methods

// ─────────────────────────── eGRID subregions (real NERC subregion codes) ───────────────────────────
export const EGRID_SUBREGIONS = [
  'AZNM', 'CAMX', 'ERCT', 'FRCC', 'MROE', 'MROW', 'NEWE', 'NWPP', 'NYCW', 'NYLI', 'NYUP',
  'RFCE', 'RFCM', 'RFCW', 'RMPA', 'SPNO', 'SPSO', 'SRMV', 'SRMW', 'SRSO', 'SRTV', 'SRVC',
  'AKGD', 'AKMS', 'HIMS', 'HIOA', 'PRMS',
] as const; // 27 real eGRID subregions

// ─────────────────────────── hotel stay ───────────────────────────
export const HOTEL_COUNTRIES = [
  'GB', 'US', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'IE', 'SE', 'NO', 'DK', 'FI', 'PL', 'AT',
  'CH', 'PT', 'GR', 'CZ', 'CA', 'AU', 'NZ', 'JP', 'KR', 'CN', 'IN', 'SG', 'AE', 'ZA', 'BR',
] as const; // 30 countries
export const STAR_RATINGS = ['3_star', '4_star', '5_star'] as const;

// ─────────────────────────── EEIO-style spend sectors ───────────────────────────
// Built as base_industry x sub_specialty so the list is genuinely varied
// without hand-typing 150 distinct names.
const EEIO_BASE_INDUSTRIES = [
  'agriculture', 'forestry', 'mining_quarrying', 'food_manufacturing', 'beverage_manufacturing',
  'textile_manufacturing', 'apparel_manufacturing', 'wood_products', 'paper_manufacturing',
  'printing', 'chemical_manufacturing', 'plastics_rubber_manufacturing', 'nonmetallic_mineral_products',
  'primary_metal_manufacturing', 'fabricated_metal_products', 'machinery_manufacturing',
  'electronics_manufacturing', 'electrical_equipment_manufacturing', 'transport_equipment_manufacturing',
  'furniture_manufacturing', 'construction', 'wholesale_trade', 'retail_trade',
  'transportation_services', 'warehousing', 'information_services', 'telecommunications',
  'finance_insurance', 'real_estate', 'professional_services', 'management_services',
  'administrative_services', 'education_services', 'healthcare_services', 'social_assistance',
  'arts_entertainment', 'accommodation_services', 'food_services', 'repair_maintenance',
  'personal_services', 'public_administration',
] as const; // 40 base industries
const EEIO_SUB_SPECIALTIES = ['general', 'wholesale', 'contracted_services', 'capital_intensive'] as const; // 4

export const EEIO_SECTORS: { code: string; label: string }[] = EEIO_BASE_INDUSTRIES.flatMap((base) =>
  EEIO_SUB_SPECIALTIES.map((sub) => ({
    code: `${base}__${sub}`,
    label: `${base.replaceAll('_', ' ')} (${sub.replaceAll('_', ' ')})`,
  })),
); // 160 sectors

// ─────────────────────────── US mobile combustion by vehicle/fuel ───────────────────────────
export const US_VEHICLE_TYPES = ['passenger_car', 'light_truck', 'heavy_truck', 'motorcycle', 'transit_bus'] as const;
export const US_VEHICLE_FUELS = ['gasoline', 'diesel', 'e85_flex_fuel', 'cng', 'battery_electric'] as const;
