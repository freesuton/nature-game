"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Maps = exports.CaveMapConfig = exports.ForestMapConfig = exports.SimpleMapConfig = void 0;
exports.getMapConfig = getMapConfig;
exports.getRandomMapName = getRandomMapName;
exports.getRandomMapConfig = getRandomMapConfig;
exports.SimpleMapConfig = {
    name: 'SimpleMap',
    width: 800,
    height: 600,
    gravity: { x: 0, y: 600 },
    platforms: [
        { x: 0, y: 500, width: 800, height: 20, type: 'ground' },
        { x: 600, y: 400, width: 200, height: 20, type: 'platform' },
        { x: 50, y: 250, width: 200, height: 20, type: 'platform' },
        { x: 750, y: 220, width: 200, height: 20, type: 'platform' }
    ],
    gunSpawns: [
        { id: 'center_gun', x: 400, y: 490 }, // Center of ground platform
        { id: 'platform_gun', x: 150, y: 240 }, // On left platform
        { id: 'platform_gun_right', x: 800, y: 480 } // On right platform
    ]
};
exports.ForestMapConfig = {
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
    ],
    gunSpawns: [
        { id: 'forest_center', x: 275, y: 440 }, // On first platform
        { id: 'forest_high', x: 675, y: 140 }, // On highest platform
        { id: 'forest_ground', x: 100, y: 540 }, // On ground left side
        { id: 'forest_ground_right', x: 800, y: 480 } // On ground right side
    ]
};
exports.CaveMapConfig = {
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
    ],
    gunSpawns: [
        { id: 'cave_left', x: 200, y: 390 }, // On left platform
        { id: 'cave_right', x: 610, y: 290 }, // On right platform  
        { id: 'cave_center', x: 400, y: 190 }, // On center platform
        { id: 'cave_border', x: 800, y: 480 } // On ground left side
    ]
};
// Map registry for easy access
exports.Maps = {
    simple: exports.SimpleMapConfig,
    forest: exports.ForestMapConfig,
    cave: exports.CaveMapConfig
};
// Helper function to get map by name
function getMapConfig(mapName) {
    return exports.Maps[mapName];
}
// Helper function to get a random map
function getRandomMapName() {
    const mapNames = Object.keys(exports.Maps);
    const randomValue = Math.random();
    const randomIndex = Math.floor(randomValue * mapNames.length);
    console.log(`Random selection: value=${randomValue}, index=${randomIndex}, available=[${mapNames.join(', ')}], selected=${mapNames[randomIndex]}`);
    return mapNames[randomIndex];
}
// Helper function to get random map config
function getRandomMapConfig() {
    const randomMapName = getRandomMapName();
    return getMapConfig(randomMapName);
}
//# sourceMappingURL=MapConfig.js.map