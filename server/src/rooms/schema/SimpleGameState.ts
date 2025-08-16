import { Schema, MapSchema, type } from '@colyseus/schema';
import { SimplePlayerState } from './SimplePlayerState';
import { WeaponState } from './WeaponState';
import { BulletState } from './BulletState';

export class SimpleGameState extends Schema {
  @type({ map: SimplePlayerState }) players = new MapSchema<SimplePlayerState>();
  @type({ map: WeaponState }) weapons = new MapSchema<WeaponState>();
  @type({ map: BulletState }) bullets = new MapSchema<BulletState>();
}