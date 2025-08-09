import { Schema, MapSchema, type } from '@colyseus/schema';
import { SimplePlayerState } from './SimplePlayerState';
import { GunState } from './GunState';

export class SimpleGameState extends Schema {
  @type({ map: SimplePlayerState }) players = new MapSchema<SimplePlayerState>();
  @type({ map: GunState }) guns = new MapSchema<GunState>();
}