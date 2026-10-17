export interface TacticalLocation {
  id: string;
  city: string;
  district: string;
  street: string;
  label: string;
  lat: number;
  lng: number;
  description: string;
  defaultType?: 'flood' | 'structural_collapse' | 'medical_emergency' | 'fire' | 'power_outage' | 'hazmat';
}

export const CITIES = [
  'Central Metro',
  'Harbor Coastal District',
  'River Valley Basin',
  'Medical & University Center',
  'West Industrial Zone',
  'Northern Ridge & Canyon',
] as const;

export type CityName = (typeof CITIES)[number];

export const TACTICAL_LOCATIONS: TacticalLocation[] = [
  // Central Metro
  {
    id: 'metro_civic',
    city: 'Central Metro',
    district: 'Civic Core',
    street: '100 N Main St & 1st St',
    label: 'Civic Plaza & Government Center',
    lat: 34.0537,
    lng: -118.2427,
    description: 'Central administrative plaza and emergency coordination hub',
    defaultType: 'structural_collapse',
  },
  {
    id: 'metro_grand',
    city: 'Central Metro',
    district: 'Financial District',
    street: 'Grand Ave & 5th St',
    label: 'Metro Financial Tower',
    lat: 34.0522,
    lng: -118.2437,
    description: 'High-density commercial sector, multi-level subterranean parking',
    defaultType: 'power_outage',
  },
  {
    id: 'metro_broadway',
    city: 'Central Metro',
    district: 'Historic Core',
    street: 'Broadway & 7th St',
    label: 'Broadway Commercial Corridor',
    lat: 34.0450,
    lng: -118.2530,
    description: 'Crowded pedestrian corridor and heritage masonry structures',
    defaultType: 'structural_collapse',
  },

  // Harbor Coastal District
  {
    id: 'harbor_pier4',
    city: 'Harbor Coastal District',
    district: 'Port Terminal',
    street: 'Pier 4 Seaside Way',
    label: 'Container Terminal 4 & Sea Wall',
    lat: 33.7420,
    lng: -118.2700,
    description: 'Water rescue staging area, heavy crane operations, storm surge barrier',
    defaultType: 'flood',
  },
  {
    id: 'harbor_marina',
    city: 'Harbor Coastal District',
    district: 'Waterfront',
    street: '2200 Ocean Blvd & Marina Way',
    label: 'Marina Bay Waterfront Esplanade',
    lat: 33.7650,
    lng: -118.1900,
    description: 'Primary boat evacuation point and coastal triage outpost',
    defaultType: 'flood',
  },
  {
    id: 'harbor_dock3',
    city: 'Harbor Coastal District',
    district: 'Dry Dock',
    street: 'Naval Dock Rd & Gate 8',
    label: 'Deepwater Fleet Fueling Berth',
    lat: 33.7550,
    lng: -118.2300,
    description: 'Vessel repair docks and hazardous chemical container yard',
    defaultType: 'hazmat',
  },

  // River Valley Basin
  {
    id: 'river_bridge',
    city: 'River Valley Basin',
    district: 'Riverway',
    street: 'Old River Bridge Rd & Crossing Way',
    label: 'North River Road Bridge',
    lat: 34.0670,
    lng: -118.2320,
    description: 'Low-lying river crossing susceptible to flash flooding and swiftwater flow',
    defaultType: 'flood',
  },
  {
    id: 'river_pump',
    city: 'River Valley Basin',
    district: 'Levee South',
    street: '450 Riverdale Blvd & Dike 3',
    label: 'East Basin Drainage Pump Station',
    lat: 34.0610,
    lng: -118.2250,
    description: 'Critical municipal stormwater pump facility and reservoir levee',
    defaultType: 'power_outage',
  },
  {
    id: 'river_depot',
    city: 'River Valley Basin',
    district: 'Freight Yards',
    street: 'Railroad Ave & Junction 14',
    label: 'Valley Rail Freight Transfer Yard',
    lat: 34.0710,
    lng: -118.2210,
    description: 'Train switching yard and potential hazardous freight containment zone',
    defaultType: 'hazmat',
  },

  // Medical & University Center
  {
    id: 'med_general',
    city: 'Medical & University Center',
    district: 'Health Sciences',
    street: '1200 Health Parkway & Clinic Dr',
    label: 'Metropolitan General Hospital',
    lat: 34.0580,
    lng: -118.2560,
    description: 'Level 1 Trauma Center, emergency helipad, mass triage receiving ward',
    defaultType: 'medical_emergency',
  },
  {
    id: 'med_shelter',
    city: 'Medical & University Center',
    district: 'Campus West',
    street: '800 Community Way & College Blvd',
    label: 'Regional Evacuation Shelter #1 (Arena)',
    lat: 34.0720,
    lng: -118.2450,
    description: '2,000-bed secondary evacuation center with generator backup and supply stock',
    defaultType: 'medical_emergency',
  },

  // West Industrial Zone
  {
    id: 'ind_warehouse',
    city: 'West Industrial Zone',
    district: 'Logistics Park',
    street: '3400 Industrial Way & Cargo St',
    label: 'Emergency Logistics Supply Depot West',
    lat: 34.0410,
    lng: -118.2650,
    description: 'Food, water rations, and heavy rescue equipment distribution center',
    defaultType: 'power_outage',
  },
  {
    id: 'ind_chemical',
    city: 'West Industrial Zone',
    district: 'Refinery Sector',
    street: 'Chemical Row & Pipeline Blvd',
    label: 'Tri-County Chemical Storage Yard',
    lat: 34.0350,
    lng: -118.2720,
    description: 'High-hazard industrial storage requiring hazmat containment perimeter',
    defaultType: 'hazmat',
  },

  // Northern Ridge & Canyon
  {
    id: 'ridge_pass',
    city: 'Northern Ridge & Canyon',
    district: 'Mountain Pass',
    street: 'Ridge Canyon Route 12 (Milepost 8)',
    label: 'Highland Canyon Transit Route',
    lat: 34.0850,
    lng: -118.2600,
    description: 'Steep canyon transit artery prone to rockfall, mudslides, and brushfires',
    defaultType: 'fire',
  },
  {
    id: 'ridge_outpost',
    city: 'Northern Ridge & Canyon',
    district: 'Lookout Point',
    street: 'Highland Crest Blvd & Lookout Way',
    label: 'North Ridge Fire Watch & Heli-Spot',
    lat: 34.0780,
    lng: -118.2750,
    description: 'Elevated radio relay repeater mast and aerial reconnaissance spot',
    defaultType: 'fire',
  },
];

export function getLocationById(id: string): TacticalLocation | undefined {
  return TACTICAL_LOCATIONS.find((loc) => loc.id === id);
}

export function getLocationsByCity(city: string): TacticalLocation[] {
  return TACTICAL_LOCATIONS.filter((loc) => loc.city === city);
}
