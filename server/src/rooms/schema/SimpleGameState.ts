import { Schema, MapSchema, type } from '@colyseus/schema';
import { SimplePlayerState } from './SimplePlayerState';
import { GunState } from './GunState';
import { BulletState } from './BulletState';

export class SimpleGameState extends Schema {
  @type({ map: SimplePlayerState }) players = new MapSchema<SimplePlayerState>();
  @type({ map: GunState }) guns = new MapSchema<GunState>();
  @type({ map: BulletState }) bullets = new MapSchema<BulletState>();
}