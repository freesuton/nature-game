export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'ground' | 'platform';
}

export interface MapConfig {
  name: string;
  width: number;
  height: number;
  gravity: { x: number; y: number };
  platforms: Platform[];
}

export const SimpleMapConfig: MapConfig = {
  name: 'SimpleMap',
  width: 800,
  height: 600,
  gravity: { x: 0, y: 600 },
  platforms: [
    { x: 0, y: 500, width: 800, height: 20, type: 'ground' },
    { x: 600, y: 400, width: 200, height: 20, type: 'platform' },
    { x: 50, y: 250, width: 200, height: 20, type: 'platform' },
    { x: 750, y: 220, width: 200, height: 20, type: 'platform' }
  ]
};

export const ForestMapConfig: MapConfig = {
  name: 'ForestMap',
  width: 800,
  height: 600,
  gravity: { x: 0, y: 600 },
  platforms: [
    { x: 0, y: 550, width: 800, height: 50, type: 'ground' },
    { x: 200, y: 450, width: 150, height: 20, type: 'platform' },
    { x: 500, y: 350, width: 150, height: 20, type: 'platform' },
    { x: 100, y: 250, width: 200, height: 20, type: 'platform' },
    { x: 600, y: 150, width: 150, height: 20, type: 'platform' }
  ]
};

export const CaveMapConfig: MapConfig = {
  name: 'CaveMap',
  width: 800,
  height: 600,
  gravity: { x: 0, y: 800 }, // Higher gravity for cave feeling
  platforms: [
    { x: 0, y: 580, width: 800, height: 20, type: 'ground' },
    { x: 0, y: 0, width: 800, height: 20, type: 'platform' }, // Ceiling
    { x: 150, y: 400, width: 100, height: 20, type: 'platform' },
    { x: 550, y: 300, width: 120, height: 20, type: 'platform' },
    { x: 300, y: 200, width: 200, height: 20, type: 'platform' }
  ]
};

// Map registry for easy access
export const Maps = {
  simple: SimpleMapConfig,
  forest: ForestMapConfig,
  cave: CaveMapConfig
} as const;

export type MapName = keyof typeof Maps;

// Helper function to get map by name
export function getMapConfig(mapName: MapName): MapConfig {
  return Maps[mapName];
}

// Helper function to get a random map
export function getRandomMapName(): MapName {
  const mapNames = Object.keys(Maps) as MapName[];
  const randomValue = Math.random();
  const randomIndex = Math.floor(randomValue * mapNames.length);
  console.log(`Random selection: value=${randomValue}, index=${randomIndex}, available=[${mapNames.join(', ')}], selected=${mapNames[randomIndex]}`);
  return mapNames[randomIndex];
}

// Helper function to get random map config
export function getRandomMapConfig(): MapConfig {
  const randomMapName = getRandomMapName();
  return getMapConfig(randomMapName);
}