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
    gravity: {
        x: number;
        y: number;
    };
    platforms: Platform[];
}
export declare const SimpleMapConfig: MapConfig;
export declare const ForestMapConfig: MapConfig;
export declare const CaveMapConfig: MapConfig;
export declare const Maps: {
    readonly simple: MapConfig;
    readonly forest: MapConfig;
    readonly cave: MapConfig;
};
export type MapName = keyof typeof Maps;
export declare function getMapConfig(mapName: MapName): MapConfig;
export declare function getRandomMapName(): MapName;
export declare function getRandomMapConfig(): MapConfig;
//# sourceMappingURL=MapConfig.d.ts.map