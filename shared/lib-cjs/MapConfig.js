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
    weaponSpawns: [
        { id: 'center_weapon', x: 400, y: 490, type: 'weapon' }, // Center of ground
        { id: 'left_weapon', x: 200, y: 490, type: 'gun' }, // Left of center
        { id: 'right_weapon', x: 600, y: 490, type: 'sword' } // Right of center
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
    weaponSpawns: [
        { id: 'forest_weapon', type: 'gun', x: 400, y: 450 }, // Center of ground
        { id: 'left_weapon', type: 'sword', x: 200, y: 450 }, // Left of center
        { id: 'right_weapon', type: 'sword', x: 600, y: 450 } // Right of center
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
    weaponSpawns: [
        { id: 'cave_weapon', type: 'gun', x: 400, y: 540 }, // Center of ground
        { id: 'left_weapon', type: 'sword', x: 200, y: 540 }, // Left of center
        { id: 'right_weapon', type: 'sword', x: 600, y: 540 } // Right of center
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